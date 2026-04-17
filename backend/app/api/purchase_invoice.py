from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.auth import (
    require_admin,
    require_operator_or_admin,
    require_viewer_or_above,
)
from app.core.database import get_db
from app.models.purchase_invoice import PurchaseInvoiceDtl, PurchaseInvoiceHdr
from app.models.user import User
from app.models.vendor_payment import VendorPayment
from app.schemas.purchase_invoice import PurchaseInvoiceCreate, PurchaseInvoiceOut
from app.utils.audit import log_activity
from app.utils.audit_constants import AuditAction, AuditModule
from app.utils.numbering import get_next_number
from app.utils.status import (
    STATUS_CANCELLED,
    STATUS_PAID,
    compute_balance,
    compute_status,
)
from app.utils.text import normalize_upper

router = APIRouter(prefix="/purchase-invoices", tags=["Purchase Invoices"])


# -----------------------------
# INPUT / OUTPUT MODELS
# -----------------------------
class PayBillIn(BaseModel):
    amount: float
    remark: str | None = None


class ReversePaymentOut(BaseModel):
    ok: bool
    payment_no: str
    bill_no: str
    reversed_amount: float
    message: str


class PurchaseInvoiceLineUpdateIn(BaseModel):
    item_code: str
    qty: float = Field(gt=0)
    rate: float = Field(ge=0)


class PurchaseInvoiceUpdateIn(BaseModel):
    bill_date: date | None = None
    due_date: date | None = None
    vendor_code: str | None = None
    tax_percent: float | None = None
    remark: str | None = None
    lines: list[PurchaseInvoiceLineUpdateIn] | None = None

    @model_validator(mode="after")
    def validate_update_payload(self):
        restricted_only = (
            self.bill_date is None
            and self.vendor_code is None
            and self.tax_percent is None
            and self.lines is None
        )

        if restricted_only:
            if self.due_date is None and self.remark is None:
                raise ValueError("Provide at least one allowed field to update")
            return self

        missing = []
        if self.bill_date is None:
            missing.append("bill_date")
        if self.vendor_code is None:
            missing.append("vendor_code")
        if self.tax_percent is None:
            missing.append("tax_percent")
        if self.lines is None:
            missing.append("lines")

        if missing:
            raise ValueError(
                f"Full purchase bill update requires: {', '.join(missing)}"
            )

        return self


class CancelBillIn(BaseModel):
    remark: str | None = None


# -----------------------------
# HELPERS
# -----------------------------
def to_decimal(value) -> Decimal:
    return Decimal(str(value or 0))


def normalize_bill_status(obj: PurchaseInvoiceHdr) -> PurchaseInvoiceHdr:
    current_status = str(obj.status or "").upper()

    if current_status == STATUS_CANCELLED:
        obj.status = STATUS_CANCELLED
        return obj

    obj.status = compute_status(
        grand_total=obj.grand_total,
        amount_done=obj.amount_paid,
        adjusted_amount=obj.adjusted_amount,
        balance=obj.balance,
        due_date=obj.due_date,
        cancelled=False,
    )
    return obj


def has_any_payment(db: Session, bill_no: str) -> bool:
    payment = (
        db.query(VendorPayment.payment_no)
        .filter(VendorPayment.bill_no == bill_no)
        .first()
    )
    return payment is not None


# -----------------------------
# LIST PURCHASE INVOICES
# -----------------------------
@router.get("/", response_model=list[PurchaseInvoiceOut])
def list_purchase_invoices(
    q: str | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    query = db.query(PurchaseInvoiceHdr)

    if q and q.strip():
        search = q.strip().upper()
        query = query.filter(
            or_(
                PurchaseInvoiceHdr.bill_no.ilike(f"%{search}%"),
                PurchaseInvoiceHdr.vendor_code.ilike(f"%{search}%"),
            )
        )

    if from_date:
        query = query.filter(PurchaseInvoiceHdr.bill_date >= from_date)

    if to_date:
        query = query.filter(PurchaseInvoiceHdr.bill_date <= to_date)

    rows = query.order_by(
        PurchaseInvoiceHdr.bill_date.desc(),
        PurchaseInvoiceHdr.bill_no.desc(),
    ).all()

    final_status = status.strip().upper() if status and status.strip() else None

    result = []
    for r in rows:
        normalize_bill_status(r)

        if final_status and r.status != final_status:
            continue

        result.append(r)

    return result


# -----------------------------
# GET SINGLE PURCHASE INVOICE
# -----------------------------
@router.get("/{bill_no}", response_model=PurchaseInvoiceOut)
def get_purchase_invoice(
    bill_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    obj = (
        db.query(PurchaseInvoiceHdr)
        .options(joinedload(PurchaseInvoiceHdr.lines))
        .filter(PurchaseInvoiceHdr.bill_no == bill_no.strip().upper())
        .first()
    )

    if not obj:
        raise HTTPException(status_code=404, detail="Purchase invoice not found")

    normalize_bill_status(obj)
    return obj


# -----------------------------
# CREATE PURCHASE INVOICE
# -----------------------------
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
    tax_percent = to_decimal(data.get("tax_percent"))
    remark = data.get("remark")
    lines = data.get("lines", [])

    if not lines:
        raise HTTPException(status_code=400, detail="At least one line is required")

    subtotal = Decimal("0.00")
    dtl_rows: list[PurchaseInvoiceDtl] = []

    for ln in lines:
        ln = normalize_upper(ln)

        qty = to_decimal(ln["qty"])
        rate = to_decimal(ln["rate"])

        if qty <= 0:
            raise HTTPException(status_code=400, detail="Qty must be greater than 0")
        if rate < 0:
            raise HTTPException(status_code=400, detail="Rate cannot be negative")

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
    adjusted_amount = Decimal("0.00")
    balance = compute_balance(grand_total, amount_paid, adjusted_amount)
    status = compute_status(
        grand_total=grand_total,
        amount_done=amount_paid,
        adjusted_amount=adjusted_amount,
        balance=balance,
        due_date=due_date,
        cancelled=False,
    )

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
        adjusted_amount=adjusted_amount,
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
            "amount_paid": float(hdr.amount_paid),
            "adjusted_amount": float(hdr.adjusted_amount),
            "balance": float(hdr.balance),
            "status": hdr.status,
            "remark": hdr.remark,
            "line_count": len(lines),
        },
    )

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=str(e.orig) if getattr(e, "orig", None) else "Could not create purchase invoice due to a conflicting change",
        )

    db.refresh(hdr)
    normalize_bill_status(hdr)
    return hdr


# -----------------------------
# UPDATE PURCHASE INVOICE
# -----------------------------
@router.put("/{bill_no}", response_model=PurchaseInvoiceOut)
def update_purchase_invoice(
    bill_no: str,
    payload: PurchaseInvoiceUpdateIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    bill_no = bill_no.strip().upper()

    obj = (
        db.query(PurchaseInvoiceHdr)
        .options(joinedload(PurchaseInvoiceHdr.lines))
        .filter(PurchaseInvoiceHdr.bill_no == bill_no)
        .first()
    )

    if not obj:
        raise HTTPException(status_code=404, detail="Purchase invoice not found")

    normalize_bill_status(obj)
    current_status = str(obj.status or "").upper()

    if current_status == STATUS_CANCELLED:
        raise HTTPException(status_code=400, detail="Cancelled bill cannot be updated")

    if current_status == STATUS_PAID:
        raise HTTPException(status_code=400, detail="Paid bill cannot be updated")

    payment_exists = has_any_payment(db, bill_no)
    amount_paid = to_decimal(obj.amount_paid)
    adjusted_amount = to_decimal(obj.adjusted_amount)

    old_values = {
        "bill_date": str(obj.bill_date),
        "due_date": str(obj.due_date) if obj.due_date else None,
        "vendor_code": obj.vendor_code,
        "subtotal": float(obj.subtotal or 0),
        "tax_percent": float(obj.tax_percent or 0),
        "tax_amount": float(obj.tax_amount or 0),
        "grand_total": float(obj.grand_total or 0),
        "amount_paid": float(obj.amount_paid or 0),
        "adjusted_amount": float(obj.adjusted_amount or 0),
        "balance": float(obj.balance or 0),
        "status": obj.status,
        "remark": obj.remark,
        "line_count": len(obj.lines or []),
    }

    raw_data = payload.model_dump(exclude_unset=True)
    data = normalize_upper(raw_data)

    restricted_only = (
        "bill_date" not in data
        and "vendor_code" not in data
        and "tax_percent" not in data
        and "lines" not in data
    )

    if restricted_only:
        obj.due_date = data.get("due_date", obj.due_date)
        obj.remark = data.get("remark", obj.remark)

        obj.status = compute_status(
            grand_total=obj.grand_total,
            amount_done=obj.amount_paid,
            adjusted_amount=obj.adjusted_amount,
            balance=obj.balance,
            due_date=obj.due_date,
            cancelled=False,
        )

        log_activity(
            db=db,
            request=request,
            user_id=current_user.user_id,
            action=AuditAction.UPDATE,
            module=AuditModule.PURCHASE_INVOICE,
            record_id=obj.bill_no,
            record_name=obj.bill_no,
            details=f"Purchase invoice restricted update: {obj.bill_no}",
            old_values=old_values,
            new_values={
                "bill_date": str(obj.bill_date),
                "due_date": str(obj.due_date) if obj.due_date else None,
                "vendor_code": obj.vendor_code,
                "subtotal": float(obj.subtotal),
                "tax_percent": float(obj.tax_percent),
                "tax_amount": float(obj.tax_amount),
                "grand_total": float(obj.grand_total),
                "amount_paid": float(obj.amount_paid),
                "adjusted_amount": float(obj.adjusted_amount or 0),
                "balance": float(obj.balance),
                "status": obj.status,
                "remark": obj.remark,
                "line_count": len(obj.lines),
            },
        )

        try:
            db.commit()
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail=str(e.orig) if getattr(e, "orig", None) else "Could not update purchase invoice due to a conflicting change",
            )

        db.refresh(obj)
        normalize_bill_status(obj)
        return obj

    if payment_exists or amount_paid > 0:
        raise HTTPException(
            status_code=400,
            detail="Bill with payment allows restricted edit only. Change due date or remark only.",
        )

    lines = data.get("lines", [])
    if not lines:
        raise HTTPException(status_code=400, detail="At least one line is required")

    subtotal = Decimal("0.00")
    new_lines: list[PurchaseInvoiceDtl] = []

    for ln in lines:
        ln = normalize_upper(ln)

        qty = to_decimal(ln["qty"])
        rate = to_decimal(ln["rate"])

        if qty <= 0:
            raise HTTPException(status_code=400, detail="Qty must be greater than 0")
        if rate < 0:
            raise HTTPException(status_code=400, detail="Rate cannot be negative")

        line_total = qty * rate
        subtotal += line_total

        new_lines.append(
            PurchaseInvoiceDtl(
                bill_no=obj.bill_no,
                item_code=ln["item_code"],
                qty=qty,
                rate=rate,
                line_total=line_total,
            )
        )

    tax_percent = to_decimal(data.get("tax_percent"))
    tax_amount = (subtotal * tax_percent) / Decimal("100")
    grand_total = subtotal + tax_amount
    new_balance = compute_balance(grand_total, amount_paid, adjusted_amount)

    if new_balance < 0:
        raise HTTPException(
            status_code=400,
            detail="Grand total cannot be less than settled amount",
        )

    obj.bill_date = data["bill_date"]
    obj.due_date = data.get("due_date")
    obj.vendor_code = data["vendor_code"]
    obj.tax_percent = tax_percent
    obj.tax_amount = tax_amount
    obj.subtotal = subtotal
    obj.grand_total = grand_total
    obj.balance = new_balance
    obj.remark = data.get("remark")
    obj.status = compute_status(
        grand_total=obj.grand_total,
        amount_done=obj.amount_paid,
        adjusted_amount=obj.adjusted_amount,
        balance=obj.balance,
        due_date=obj.due_date,
        cancelled=False,
    )

    obj.lines.clear()
    for ln in new_lines:
        obj.lines.append(ln)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.UPDATE,
        module=AuditModule.PURCHASE_INVOICE,
        record_id=obj.bill_no,
        record_name=obj.bill_no,
        details=f"Purchase invoice updated: {obj.bill_no}",
        old_values=old_values,
        new_values={
            "bill_date": str(obj.bill_date),
            "due_date": str(obj.due_date) if obj.due_date else None,
            "vendor_code": obj.vendor_code,
            "subtotal": float(obj.subtotal),
            "tax_percent": float(obj.tax_percent),
            "tax_amount": float(obj.tax_amount),
            "grand_total": float(obj.grand_total),
            "amount_paid": float(obj.amount_paid),
            "adjusted_amount": float(obj.adjusted_amount or 0),
            "balance": float(obj.balance),
            "status": obj.status,
            "remark": obj.remark,
            "line_count": len(obj.lines),
        },
    )

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=str(e.orig) if getattr(e, "orig", None) else "Could not update purchase invoice due to a conflicting change",
        )

    db.refresh(obj)
    normalize_bill_status(obj)
    return obj


# -----------------------------
# CANCEL PURCHASE INVOICE
# -----------------------------
@router.patch("/{bill_no}/cancel", response_model=PurchaseInvoiceOut)
def cancel_purchase_invoice(
    bill_no: str,
    payload: CancelBillIn | None = None,
    request: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    bill_no = bill_no.strip().upper()

    obj = (
        db.query(PurchaseInvoiceHdr)
        .options(joinedload(PurchaseInvoiceHdr.lines))
        .filter(PurchaseInvoiceHdr.bill_no == bill_no)
        .first()
    )

    if not obj:
        raise HTTPException(status_code=404, detail="Purchase invoice not found")

    normalize_bill_status(obj)

    if str(obj.status or "").upper() == STATUS_CANCELLED:
        raise HTTPException(status_code=400, detail="Bill is already cancelled")

    if has_any_payment(db, bill_no) or to_decimal(obj.amount_paid) > 0:
        raise HTTPException(
            status_code=400,
            detail="Reverse payment(s) first before cancelling bill",
        )

    old_values = {
        "status": obj.status,
        "remark": obj.remark,
    }

    cancel_remark = None
    if payload and payload.remark and str(payload.remark).strip():
        cancel_remark = str(payload.remark).strip().upper()

    obj.status = STATUS_CANCELLED
    obj.amount_paid = Decimal("0.00")
    obj.adjusted_amount = Decimal("0.00")
    obj.balance = Decimal("0.00")

    if cancel_remark:
        obj.remark = cancel_remark

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.UPDATE,
        module=AuditModule.PURCHASE_INVOICE,
        record_id=obj.bill_no,
        record_name=obj.bill_no,
        details=f"Purchase invoice cancelled: {obj.bill_no}",
        old_values=old_values,
        new_values={
            "status": obj.status,
            "remark": obj.remark,
            "amount_paid": float(obj.amount_paid or 0),
            "adjusted_amount": float(obj.adjusted_amount or 0),
            "balance": float(obj.balance or 0),
        },
    )

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=str(e.orig) if getattr(e, "orig", None) else "Could not cancel purchase invoice due to a conflicting change",
        )

    db.refresh(obj)
    return obj


# -----------------------------
# DELETE PURCHASE INVOICE
# ADMIN ONLY
# ALLOW ONLY WHEN BALANCE = 0
# AUTO DELETE LINKED PAYMENTS
# -----------------------------
@router.delete("/{bill_no}")
def delete_purchase_invoice(
    bill_no: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    bill_no = bill_no.strip().upper()

    obj = (
        db.query(PurchaseInvoiceHdr)
        .options(joinedload(PurchaseInvoiceHdr.lines))
        .filter(PurchaseInvoiceHdr.bill_no == bill_no)
        .first()
    )

    if not obj:
        raise HTTPException(status_code=404, detail="Purchase invoice not found")

    balance = to_decimal(obj.balance)
    if balance != Decimal("0"):
        raise HTTPException(
            status_code=400,
            detail="Delete allowed only when bill balance is 0",
        )

    payments = (
        db.query(VendorPayment)
        .filter(VendorPayment.bill_no == bill_no)
        .all()
    )
    payment_count = len(payments)

    old_values = {
        "bill_no": obj.bill_no,
        "vendor_code": obj.vendor_code,
        "bill_date": str(obj.bill_date),
        "due_date": str(obj.due_date) if obj.due_date else None,
        "subtotal": float(obj.subtotal or 0),
        "tax_percent": float(obj.tax_percent or 0),
        "tax_amount": float(obj.tax_amount or 0),
        "grand_total": float(obj.grand_total or 0),
        "amount_paid": float(obj.amount_paid or 0),
        "adjusted_amount": float(obj.adjusted_amount or 0),
        "balance": float(obj.balance or 0),
        "status": obj.status,
        "remark": obj.remark,
        "line_count": len(obj.lines or []),
        "payment_count_deleted": payment_count,
    }

    for payment in payments:
        db.delete(payment)

    db.query(PurchaseInvoiceDtl).filter(
        PurchaseInvoiceDtl.bill_no == obj.bill_no
    ).delete(synchronize_session=False)

    db.delete(obj)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.DELETE,
        module=AuditModule.PURCHASE_INVOICE,
        record_id=bill_no,
        record_name=bill_no,
        details=f"Purchase invoice deleted with {payment_count} payment(s): {bill_no}",
        old_values=old_values,
        new_values=None,
    )

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=str(e.orig) if getattr(e, "orig", None) else "Could not delete purchase invoice due to a conflicting change",
        )

    return {
        "ok": True,
        "message": f"Purchase invoice {bill_no} deleted successfully with {payment_count} payment(s)",
    }


# -----------------------------
# PAY BILL
# -----------------------------
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

    normalize_bill_status(obj)

    if str(obj.status or "").upper() == STATUS_CANCELLED:
        raise HTTPException(
            status_code=400,
            detail="Cannot pay a cancelled bill",
        )

    amount = Decimal(str(payload.amount or 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    current_balance = Decimal(str(obj.balance or 0))
    if amount > current_balance:
        raise HTTPException(status_code=400, detail="Paid amount cannot exceed balance")

    old_values = {
        "amount_paid": float(obj.amount_paid or 0),
        "adjusted_amount": float(obj.adjusted_amount or 0),
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
    obj.balance = compute_balance(
        obj.grand_total,
        obj.amount_paid,
        obj.adjusted_amount,
    )
    obj.status = compute_status(
        grand_total=obj.grand_total,
        amount_done=obj.amount_paid,
        adjusted_amount=obj.adjusted_amount,
        due_date=obj.due_date,
        cancelled=False,
        balance=obj.balance,
    )

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
            "adjusted_amount": float(obj.adjusted_amount or 0),
            "balance": float(obj.balance),
            "status": obj.status,
        },
    )

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=str(e.orig) if getattr(e, "orig", None) else "Could not save vendor payment due to a concurrent update. Please try again.",
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


# -----------------------------
# REVERSE VENDOR PAYMENT
# -----------------------------
@router.delete("/payments/{payment_no}", response_model=ReversePaymentOut)
def reverse_vendor_payment(
    payment_no: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    payment_no = payment_no.strip().upper()

    payment = (
        db.execute(
            select(VendorPayment)
            .where(VendorPayment.payment_no == payment_no)
            .with_for_update()
        )
        .scalar_one_or_none()
    )

    if not payment:
        raise HTTPException(status_code=404, detail="Vendor payment not found")

    bill = (
        db.execute(
            select(PurchaseInvoiceHdr)
            .where(PurchaseInvoiceHdr.bill_no == payment.bill_no)
            .with_for_update()
        )
        .scalar_one_or_none()
    )

    if not bill:
        raise HTTPException(
            status_code=404,
            detail="Linked purchase bill not found for this payment",
        )

    reverse_amount = to_decimal(payment.amount)

    if reverse_amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid payment amount for reversal")

    current_amount_paid = to_decimal(bill.amount_paid)

    if reverse_amount > current_amount_paid:
        raise HTTPException(
            status_code=400,
            detail="Payment reversal amount cannot exceed amount already paid",
        )

    old_values = {
        "payment_no": payment.payment_no,
        "bill_no": payment.bill_no,
        "payment_date": str(payment.payment_date),
        "amount": float(payment.amount or 0),
        "remark": payment.remark,
        "bill_amount_paid": float(bill.amount_paid or 0),
        "bill_adjusted_amount": float(bill.adjusted_amount or 0),
        "bill_balance": float(bill.balance or 0),
        "bill_status": bill.status,
    }

    new_amount_paid = current_amount_paid - reverse_amount

    if new_amount_paid < 0:
        raise HTTPException(
            status_code=400,
            detail="Amount paid cannot become negative after reversal",
        )

    bill.amount_paid = new_amount_paid
    bill.balance = compute_balance(
        bill.grand_total,
        bill.amount_paid,
        bill.adjusted_amount,
    )
    bill.status = compute_status(
        grand_total=bill.grand_total,
        amount_done=bill.amount_paid,
        adjusted_amount=bill.adjusted_amount,
        due_date=bill.due_date,
        cancelled=False,
        balance=bill.balance,
    )

    db.delete(payment)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.DELETE,
        module=AuditModule.VENDOR_PAYMENT,
        record_id=payment_no,
        record_name=payment_no,
        details=f"Vendor payment reversed: {payment_no}",
        old_values=old_values,
        new_values={
            "bill_no": bill.bill_no,
            "reversed_amount": float(reverse_amount),
            "bill_amount_paid": float(bill.amount_paid),
            "bill_adjusted_amount": float(bill.adjusted_amount or 0),
            "bill_balance": float(bill.balance),
            "bill_status": bill.status,
        },
    )

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=str(e.orig) if getattr(e, "orig", None) else "Could not reverse vendor payment due to a conflicting change",
        )

    return ReversePaymentOut(
        ok=True,
        payment_no=payment_no,
        bill_no=bill.bill_no,
        reversed_amount=float(reverse_amount),
        message=f"Vendor payment {payment_no} reversed successfully",
    )