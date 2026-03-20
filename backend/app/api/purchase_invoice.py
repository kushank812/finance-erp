from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_operator_or_admin, require_viewer_or_above
from app.core.database import get_db
from app.models.purchase_invoice import PurchaseInvoiceDtl, PurchaseInvoiceHdr
from app.models.user import User
from app.models.vendor_payment import VendorPayment
from app.schemas.purchase_invoice import PurchaseInvoiceCreate, PurchaseInvoiceOut
from app.utils.audit import log_activity
from app.utils.audit_constants import AuditAction, AuditModule
from app.utils.numbering import get_next_number
from app.utils.text import normalize_upper

router = APIRouter(prefix="/purchase-invoices", tags=["Purchase Invoices"])


class PayBillIn(BaseModel):
    amount: float
    remark: str | None = None


def compute_status(
    balance: Decimal | float,
    grand_total: Decimal | float,
    due_date: date | None,
) -> str:
    bal = Decimal(str(balance or 0))
    total = Decimal(str(grand_total or 0))

    if bal <= 0:
        return "Paid"
    if bal < total:
        return "Partial"
    if due_date and date.today() > due_date:
        return "Overdue"
    return "Pending"


@router.get("/", response_model=list[PurchaseInvoiceOut])
def list_purchase_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    rows = db.query(PurchaseInvoiceHdr).order_by(
        PurchaseInvoiceHdr.bill_date.desc(),
        PurchaseInvoiceHdr.bill_no.desc(),
    ).all()

    for r in rows:
        r.status = compute_status(r.balance, r.grand_total, r.due_date)

    return rows


@router.get("/{bill_no}", response_model=PurchaseInvoiceOut)
def get_purchase_invoice(
    bill_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    obj = db.get(PurchaseInvoiceHdr, bill_no.strip().upper())
    if not obj:
        raise HTTPException(status_code=404, detail="Purchase invoice not found")

    obj.status = compute_status(obj.balance, obj.grand_total, obj.due_date)
    return obj


@router.post("/", response_model=PurchaseInvoiceOut)
def create_purchase_invoice(
    payload: PurchaseInvoiceCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    data = normalize_upper(payload.model_dump())

    try:
        bill_no = get_next_number(db, "PURCHASE_BILL", "BILL", 4)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    vendor_code = data["vendor_code"]
    bill_date = data["bill_date"]
    due_date = data.get("due_date")
    tax_percent = Decimal(str(data.get("tax_percent") or 0))
    remark = data.get("remark")
    lines = data.get("lines", [])

    if not lines:
        raise HTTPException(status_code=400, detail="At least one line is required")

    subtotal = Decimal("0.00")
    dtl_rows: list[PurchaseInvoiceDtl] = []

    for ln in lines:
        ln = normalize_upper(ln)

        qty = Decimal(str(ln["qty"]))
        rate = Decimal(str(ln["rate"]))
        line_total = qty * rate
        subtotal += line_total

        dtl_rows.append(
            PurchaseInvoiceDtl(
                bill_no=bill_no,
                item_code=ln["item_code"],
                qty=qty,
                rate=rate,
                line_total=line_total,
            )
        )

    tax_amount = (subtotal * tax_percent) / Decimal("100")
    grand_total = subtotal + tax_amount
    amount_paid = Decimal("0.00")
    balance = grand_total
    status = compute_status(balance, grand_total, due_date)

    hdr = PurchaseInvoiceHdr(
        bill_no=bill_no,
        bill_date=bill_date,
        due_date=due_date,
        vendor_code=vendor_code,
        subtotal=subtotal,
        tax_percent=tax_percent,
        tax_amount=tax_amount,
        grand_total=grand_total,
        amount_paid=amount_paid,
        balance=balance,
        status=status,
        remark=remark,
        lines=dtl_rows,
    )

    db.add(hdr)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.CREATE,
        module=AuditModule.PURCHASE_INVOICE,
        record_id=hdr.bill_no,
        record_name=hdr.bill_no,
        details=f"Purchase invoice created: {hdr.bill_no}",
        new_values={
            "bill_no": hdr.bill_no,
            "vendor_code": hdr.vendor_code,
            "bill_date": str(hdr.bill_date),
            "due_date": str(hdr.due_date) if hdr.due_date else None,
            "subtotal": float(hdr.subtotal),
            "tax_percent": float(hdr.tax_percent),
            "tax_amount": float(hdr.tax_amount),
            "grand_total": float(hdr.grand_total),
            "status": hdr.status,
            "line_count": len(lines),
        },
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Could not create purchase invoice due to a conflicting change",
        )

    db.refresh(hdr)
    return hdr


@router.post("/{bill_no}/pay")
def pay_bill(
    bill_no: str,
    payload: PayBillIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    bill_no = bill_no.strip().upper()

    obj = (
        db.execute(
            select(PurchaseInvoiceHdr)
            .where(PurchaseInvoiceHdr.bill_no == bill_no)
            .with_for_update()
        )
        .scalar_one_or_none()
    )

    if not obj:
        raise HTTPException(status_code=404, detail="Purchase invoice not found")

    amount = Decimal(str(payload.amount or 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    current_balance = Decimal(str(obj.balance or 0))
    if amount > current_balance:
        raise HTTPException(status_code=400, detail="Paid amount cannot exceed balance")

    old_values = {
        "amount_paid": float(obj.amount_paid or 0),
        "balance": float(obj.balance or 0),
        "status": obj.status,
    }

    try:
        payment_no = get_next_number(db, "VENDOR_PAYMENT", "PAY", 4)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    payment = VendorPayment(
        payment_no=payment_no,
        bill_no=obj.bill_no,
        payment_date=date.today(),
        amount=amount,
        remark=str(payload.remark).strip().upper()
        if payload.remark and str(payload.remark).strip()
        else None,
    )
    db.add(payment)

    obj.amount_paid = Decimal(str(obj.amount_paid or 0)) + amount
    obj.balance = Decimal(str(obj.grand_total or 0)) - Decimal(str(obj.amount_paid or 0))
    obj.status = compute_status(obj.balance, obj.grand_total, obj.due_date)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.CREATE,
        module=AuditModule.VENDOR_PAYMENT,
        record_id=payment.payment_no,
        record_name=payment.payment_no,
        details=f"Vendor payment for bill {obj.bill_no}",
        old_values=old_values,
        new_values={
            "payment_no": payment.payment_no,
            "bill_no": obj.bill_no,
            "payment_date": str(payment.payment_date),
            "amount": float(amount),
            "remark": payment.remark,
            "amount_paid": float(obj.amount_paid),
            "balance": float(obj.balance),
            "status": obj.status,
        },
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Could not save vendor payment due to a concurrent update. Please try again.",
        )

    db.refresh(payment)

    return {
        "ok": True,
        "payment_no": payment.payment_no,
        "bill_no": payment.bill_no,
        "payment_date": str(payment.payment_date),
        "amount": float(payment.amount),
        "remark": payment.remark,
    }