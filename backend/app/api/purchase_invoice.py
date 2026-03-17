from decimal import Decimal
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import require_operator_or_admin
from app.core.database import get_db
from app.models.purchase_invoice import PurchaseInvoiceHdr, PurchaseInvoiceDtl, VendorPayment
from app.models.user import User
from app.schemas.purchase_invoice import PurchaseInvoiceCreate, PurchaseInvoiceOut
from app.utils.audit import log_activity
from app.utils.audit_constants import AuditAction, AuditModule
from app.utils.text import normalize_upper

router = APIRouter(prefix="/purchase-invoices", tags=["Purchase Invoices"])


class PayBillIn(BaseModel):
    amount: float
    remark: str | None = None


def compute_status(balance: Decimal | float, grand_total: Decimal | float, due_date: date | None) -> str:
    bal = Decimal(str(balance or 0))
    total = Decimal(str(grand_total or 0))

    if bal <= 0:
        return "Paid"
    if bal < total:
        return "Partial"
    if due_date and date.today() > due_date:
        return "Overdue"
    return "Pending"


def next_payment_no(db: Session) -> str:
    rows = db.query(VendorPayment).all()
    max_no = 0

    for r in rows:
        text = str(r.payment_no or "")
        digits = "".join(ch for ch in text if ch.isdigit())
        if digits:
            max_no = max(max_no, int(digits))

    return f"PAY{max_no + 1:04d}"


@router.get("/", response_model=list[PurchaseInvoiceOut])
def list_purchase_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    rows = db.query(PurchaseInvoiceHdr).order_by(
        PurchaseInvoiceHdr.bill_date.desc(),
        PurchaseInvoiceHdr.bill_no.desc()
    ).all()

    changed = False
    for r in rows:
        new_status = compute_status(r.balance, r.grand_total, r.due_date)
        if r.status != new_status:
            r.status = new_status
            changed = True

    if changed:
        db.commit()

    return rows


@router.get("/{bill_no}", response_model=PurchaseInvoiceOut)
def get_purchase_invoice(
    bill_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    obj = db.get(PurchaseInvoiceHdr, bill_no)
    if not obj:
        raise HTTPException(status_code=404, detail="Purchase invoice not found")

    new_status = compute_status(obj.balance, obj.grand_total, obj.due_date)
    if obj.status != new_status:
        obj.status = new_status
        db.commit()
        db.refresh(obj)

    return obj


@router.post("/", response_model=PurchaseInvoiceOut)
def create_purchase_invoice(
    payload: PurchaseInvoiceCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    data = payload.model_dump()
    data = normalize_upper(data)

    bill_no = data["bill_no"]
    vendor_code = data["vendor_code"]
    bill_date = data["bill_date"]
    due_date = data.get("due_date")
    tax_percent = Decimal(str(data.get("tax_percent") or 0))
    remark = data.get("remark")
    lines = data.get("lines", [])

    existing = db.get(PurchaseInvoiceHdr, bill_no)
    if existing:
        raise HTTPException(status_code=400, detail="Bill number already exists")

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

    db.commit()
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
    obj = db.get(PurchaseInvoiceHdr, bill_no)
    if not obj:
        raise HTTPException(status_code=404, detail="Purchase invoice not found")

    amount = Decimal(str(payload.amount or 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    if amount > Decimal(str(obj.balance or 0)):
        raise HTTPException(status_code=400, detail="Paid amount cannot exceed balance")

    payment_no = next_payment_no(db)

    old_values = {
        "amount_paid": float(obj.amount_paid or 0),
        "balance": float(obj.balance or 0),
        "status": obj.status,
    }

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

    db.commit()
    db.refresh(payment)

    return {
        "ok": True,
        "payment_no": payment.payment_no,
        "bill_no": payment.bill_no,
        "payment_date": str(payment.payment_date),
        "amount": float(payment.amount),
        "remark": payment.remark,
    }