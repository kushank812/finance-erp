from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.auth import (
    require_admin,
    require_operator_or_admin,
    require_viewer_or_above,
)
from app.core.database import get_db
from app.models.sales_invoice import SalesInvoiceDtl, SalesInvoiceHdr, SalesReceipt
from app.models.user import User
from app.schemas.sales_invoice import SalesInvoiceCreate, SalesInvoiceOut
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

router = APIRouter(prefix="/sales-invoices", tags=["Sales Invoices"])

ALLOWED_INVOICE_TEMPLATES = {
    "STANDARD",
    "TAX_INVOICE",
    "SERVICE_INVOICE",
}


class ReceivePaymentIn(BaseModel):
    amount: float
    remark: str | None = None


class ReceiptCreatedOut(BaseModel):
    ok: bool
    receipt_no: str
    invoice_no: str
    receipt_date: str
    amount: float
    remark: str | None = None


class SalesInvoiceLineUpdateIn(BaseModel):
    item_code: str
    qty: float = Field(gt=0)
    rate: float = Field(ge=0)


class SalesInvoiceUpdateIn(BaseModel):
    invoice_date: date | None = None
    due_date: date | None = None
    customer_code: str | None = None
    invoice_template: str | None = None
    tax_percent: float | None = None
    remark: str | None = None
    lines: list[SalesInvoiceLineUpdateIn] | None = None

    @model_validator(mode="after")
    def validate_update_payload(self):
        restricted_only = (
            self.invoice_date is None
            and self.customer_code is None
            and self.invoice_template is None
            and self.tax_percent is None
            and self.lines is None
        )

        if restricted_only:
            if self.due_date is None and self.remark is None:
                raise ValueError("Provide due_date or remark to update")
            return self

        missing = []

        if self.invoice_date is None:
            missing.append("invoice_date")
        if self.customer_code is None:
            missing.append("customer_code")
        if self.invoice_template is None:
            missing.append("invoice_template")
        if self.tax_percent is None:
            missing.append("tax_percent")
        if self.lines is None:
            missing.append("lines")

        if missing:
            raise ValueError(f"Full invoice update requires: {', '.join(missing)}")

        return self


class CancelInvoiceIn(BaseModel):
    remark: str | None = None


def to_decimal(value) -> Decimal:
    return Decimal(str(value or 0))


def normalize_template(value: str | None) -> str:
    template = str(value or "STANDARD").strip().upper()

    if template not in ALLOWED_INVOICE_TEMPLATES:
        raise HTTPException(
            status_code=400,
            detail="Invalid invoice template. Allowed: STANDARD, TAX_INVOICE, SERVICE_INVOICE",
        )

    return template


def normalize_invoice_status(obj: SalesInvoiceHdr) -> SalesInvoiceHdr:
    current_status = str(obj.status or "").upper()

    if current_status == STATUS_CANCELLED:
        obj.status = STATUS_CANCELLED
        return obj

    obj.status = compute_status(
        grand_total=obj.grand_total,
        amount_done=obj.amount_received,
        adjusted_amount=obj.adjusted_amount,
        balance=obj.balance,
        due_date=obj.due_date,
        cancelled=False,
    )
    return obj


def has_any_receipt(db: Session, invoice_no: str) -> bool:
    receipt = (
        db.query(SalesReceipt.receipt_no)
        .filter(SalesReceipt.invoice_no == invoice_no)
        .first()
    )
    return receipt is not None


@router.get("/", response_model=list[SalesInvoiceOut])
def list_sales_invoices(
    q: str | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    query = db.query(SalesInvoiceHdr)

    if q and q.strip():
        search = q.strip().upper()
        query = query.filter(
            or_(
                SalesInvoiceHdr.invoice_no.ilike(f"%{search}%"),
                SalesInvoiceHdr.customer_code.ilike(f"%{search}%"),
            )
        )

    if from_date:
        query = query.filter(SalesInvoiceHdr.invoice_date >= from_date)

    if to_date:
        query = query.filter(SalesInvoiceHdr.invoice_date <= to_date)

    rows = query.order_by(
        SalesInvoiceHdr.invoice_date.desc(),
        SalesInvoiceHdr.invoice_no.desc(),
    ).all()

    final_status = status.strip().upper() if status and status.strip() else None

    result = []
    for r in rows:
        normalize_invoice_status(r)
        if final_status and r.status != final_status:
            continue
        result.append(r)

    return result


@router.get("/{invoice_no}", response_model=SalesInvoiceOut)
def get_sales_invoice(
    invoice_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    obj = (
        db.query(SalesInvoiceHdr)
        .options(joinedload(SalesInvoiceHdr.lines))
        .filter(SalesInvoiceHdr.invoice_no == invoice_no.strip().upper())
        .first()
    )

    if not obj:
        raise HTTPException(status_code=404, detail="Sales invoice not found")

    normalize_invoice_status(obj)
    return obj


@router.post("/", response_model=SalesInvoiceOut)
def create_sales_invoice(
    payload: SalesInvoiceCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    data = normalize_upper(payload.model_dump())

    try:
        invoice_no = get_next_number(db, "SALES_INVOICE", "INV")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    customer_code = data["customer_code"]
    invoice_template = normalize_template(data.get("invoice_template"))
    invoice_date = data["invoice_date"]
    due_date = data.get("due_date")
    tax_percent = to_decimal(data.get("tax_percent"))
    remark = data.get("remark")
    lines = data.get("lines", [])

    if tax_percent < 0:
        raise HTTPException(status_code=400, detail="Tax percent cannot be negative")

    if not lines:
        raise HTTPException(status_code=400, detail="At least one line is required")

    subtotal = Decimal("0.00")
    dtl_rows: list[SalesInvoiceDtl] = []

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
            SalesInvoiceDtl(
                invoice_no=invoice_no,
                item_code=ln["item_code"],
                qty=qty,
                rate=rate,
                line_total=line_total,
            )
        )

    tax_amount = (subtotal * tax_percent) / Decimal("100")
    grand_total = subtotal + tax_amount
    amount_received = Decimal("0.00")
    adjusted_amount = Decimal("0.00")
    balance = compute_balance(grand_total, amount_received, adjusted_amount)

    status = compute_status(
        grand_total=grand_total,
        amount_done=amount_received,
        adjusted_amount=adjusted_amount,
        balance=balance,
        due_date=due_date,
        cancelled=False,
    )

    hdr = SalesInvoiceHdr(
        invoice_no=invoice_no,
        invoice_template=invoice_template,
        invoice_date=invoice_date,
        due_date=due_date,
        customer_code=customer_code,
        subtotal=subtotal,
        tax_percent=tax_percent,
        tax_amount=tax_amount,
        grand_total=grand_total,
        amount_received=amount_received,
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
        module=AuditModule.SALES_INVOICE,
        record_id=hdr.invoice_no,
        record_name=hdr.invoice_no,
        details=f"Sales invoice created: {hdr.invoice_no}",
        new_values={
            "invoice_no": hdr.invoice_no,
            "invoice_template": hdr.invoice_template,
            "customer_code": hdr.customer_code,
            "invoice_date": str(hdr.invoice_date),
            "due_date": str(hdr.due_date) if hdr.due_date else None,
            "subtotal": float(hdr.subtotal),
            "tax_percent": float(hdr.tax_percent),
            "tax_amount": float(hdr.tax_amount),
            "grand_total": float(hdr.grand_total),
            "amount_received": float(hdr.amount_received),
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
        raise HTTPException(status_code=409, detail=str(e.orig))

    db.refresh(hdr)
    normalize_invoice_status(hdr)
    return hdr


@router.put("/{invoice_no}", response_model=SalesInvoiceOut)
def update_sales_invoice(
    invoice_no: str,
    payload: SalesInvoiceUpdateIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    invoice_no = invoice_no.strip().upper()

    obj = (
        db.query(SalesInvoiceHdr)
        .options(joinedload(SalesInvoiceHdr.lines))
        .filter(SalesInvoiceHdr.invoice_no == invoice_no)
        .first()
    )

    if not obj:
        raise HTTPException(status_code=404, detail="Sales invoice not found")

    normalize_invoice_status(obj)
    current_status = str(obj.status or "").upper()

    if current_status == STATUS_CANCELLED:
        raise HTTPException(status_code=400, detail="Cancelled invoice cannot be updated")

    if current_status == STATUS_PAID:
        raise HTTPException(status_code=400, detail="Paid invoice cannot be updated")

    receipt_exists = has_any_receipt(db, invoice_no)

    old_values = {
        "invoice_template": obj.invoice_template,
        "customer_code": obj.customer_code,
        "invoice_date": str(obj.invoice_date),
        "due_date": str(obj.due_date) if obj.due_date else None,
        "subtotal": float(obj.subtotal),
        "tax_percent": float(obj.tax_percent),
        "tax_amount": float(obj.tax_amount),
        "grand_total": float(obj.grand_total),
        "amount_received": float(obj.amount_received),
        "adjusted_amount": float(obj.adjusted_amount),
        "balance": float(obj.balance),
        "status": obj.status,
        "remark": obj.remark,
    }

    full_update_requested = (
        payload.invoice_date is not None
        or payload.customer_code is not None
        or payload.invoice_template is not None
        or payload.tax_percent is not None
        or payload.lines is not None
    )

    if receipt_exists and full_update_requested:
        raise HTTPException(
            status_code=400,
            detail="Invoice has receipt entries. Only due date and remark can be updated.",
        )

    if not full_update_requested:
        obj.due_date = payload.due_date
        obj.remark = normalize_upper(payload.remark) if payload.remark else None
        obj.balance = compute_balance(
            obj.grand_total,
            obj.amount_received,
            obj.adjusted_amount,
        )
        normalize_invoice_status(obj)

        log_activity(
            db=db,
            request=request,
            user_id=current_user.user_id,
            action=AuditAction.UPDATE,
            module=AuditModule.SALES_INVOICE,
            record_id=obj.invoice_no,
            record_name=obj.invoice_no,
            details=f"Sales invoice restricted update: {obj.invoice_no}",
            old_values=old_values,
            new_values={
                "due_date": str(obj.due_date) if obj.due_date else None,
                "remark": obj.remark,
                "status": obj.status,
            },
        )

        db.commit()
        db.refresh(obj)
        return obj

    obj.invoice_date = payload.invoice_date
    obj.due_date = payload.due_date
    obj.customer_code = normalize_upper(payload.customer_code)
    obj.invoice_template = normalize_template(payload.invoice_template)
    obj.tax_percent = to_decimal(payload.tax_percent)
    obj.remark = normalize_upper(payload.remark) if payload.remark else None

    if obj.tax_percent < 0:
        raise HTTPException(status_code=400, detail="Tax percent cannot be negative")

    if not payload.lines:
        raise HTTPException(status_code=400, detail="At least one line is required")

    obj.lines.clear()
    db.flush()

    subtotal = Decimal("0.00")

    for ln in payload.lines:
        item_code = normalize_upper(ln.item_code)
        qty = to_decimal(ln.qty)
        rate = to_decimal(ln.rate)

        if qty <= 0:
            raise HTTPException(status_code=400, detail="Qty must be greater than 0")

        if rate < 0:
            raise HTTPException(status_code=400, detail="Rate cannot be negative")

        line_total = qty * rate
        subtotal += line_total

        obj.lines.append(
            SalesInvoiceDtl(
                invoice_no=obj.invoice_no,
                item_code=item_code,
                qty=qty,
                rate=rate,
                line_total=line_total,
            )
        )

    obj.subtotal = subtotal
    obj.tax_amount = (subtotal * obj.tax_percent) / Decimal("100")
    obj.grand_total = obj.subtotal + obj.tax_amount
    obj.balance = compute_balance(
        obj.grand_total,
        obj.amount_received,
        obj.adjusted_amount,
    )

    normalize_invoice_status(obj)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.UPDATE,
        module=AuditModule.SALES_INVOICE,
        record_id=obj.invoice_no,
        record_name=obj.invoice_no,
        details=f"Sales invoice updated: {obj.invoice_no}",
        old_values=old_values,
        new_values={
            "invoice_template": obj.invoice_template,
            "customer_code": obj.customer_code,
            "invoice_date": str(obj.invoice_date),
            "due_date": str(obj.due_date) if obj.due_date else None,
            "subtotal": float(obj.subtotal),
            "tax_percent": float(obj.tax_percent),
            "tax_amount": float(obj.tax_amount),
            "grand_total": float(obj.grand_total),
            "amount_received": float(obj.amount_received),
            "adjusted_amount": float(obj.adjusted_amount),
            "balance": float(obj.balance),
            "status": obj.status,
            "remark": obj.remark,
            "line_count": len(payload.lines),
        },
    )

    db.commit()
    db.refresh(obj)
    normalize_invoice_status(obj)
    return obj


@router.post("/{invoice_no}/receive", response_model=ReceiptCreatedOut)
def receive_payment(
    invoice_no: str,
    payload: ReceivePaymentIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    invoice_no = invoice_no.strip().upper()

    obj = (
        db.query(SalesInvoiceHdr)
        .filter(SalesInvoiceHdr.invoice_no == invoice_no)
        .first()
    )

    if not obj:
        raise HTTPException(status_code=404, detail="Sales invoice not found")

    normalize_invoice_status(obj)

    if obj.status == STATUS_CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot receive against cancelled invoice")

    amount = to_decimal(payload.amount)

    if amount <= 0:
        raise HTTPException(status_code=400, detail="Receipt amount must be greater than 0")

    current_balance = compute_balance(
        obj.grand_total,
        obj.amount_received,
        obj.adjusted_amount,
    )

    if amount > current_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Receipt amount cannot exceed balance {current_balance}",
        )

    try:
        receipt_no = get_next_number(db, "SALES_RECEIPT", "REC")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    receipt = SalesReceipt(
        receipt_no=receipt_no,
        invoice_no=obj.invoice_no,
        receipt_date=date.today(),
        amount=amount,
        remark=normalize_upper(payload.remark) if payload.remark else None,
    )

    db.add(receipt)

    old_amount_received = obj.amount_received
    old_balance = obj.balance
    old_status = obj.status

    obj.amount_received = obj.amount_received + amount
    obj.balance = compute_balance(
        obj.grand_total,
        obj.amount_received,
        obj.adjusted_amount,
    )
    normalize_invoice_status(obj)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.CREATE,
        module=AuditModule.RECEIPT,
        record_id=receipt.receipt_no,
        record_name=receipt.receipt_no,
        details=f"Receipt created: {receipt.receipt_no} for invoice {obj.invoice_no}",
        old_values={
            "invoice_no": obj.invoice_no,
            "amount_received": float(old_amount_received),
            "balance": float(old_balance),
            "status": old_status,
        },
        new_values={
            "receipt_no": receipt.receipt_no,
            "invoice_no": obj.invoice_no,
            "receipt_date": str(receipt.receipt_date),
            "receipt_amount": float(receipt.amount),
            "amount_received": float(obj.amount_received),
            "balance": float(obj.balance),
            "status": obj.status,
            "remark": receipt.remark,
        },
    )

    db.commit()
    db.refresh(receipt)
    db.refresh(obj)

    return ReceiptCreatedOut(
        ok=True,
        receipt_no=receipt.receipt_no,
        invoice_no=obj.invoice_no,
        receipt_date=str(receipt.receipt_date),
        amount=float(receipt.amount),
        remark=receipt.remark,
    )


@router.post("/{invoice_no}/cancel", response_model=SalesInvoiceOut)
def cancel_sales_invoice(
    invoice_no: str,
    payload: CancelInvoiceIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    invoice_no = invoice_no.strip().upper()

    obj = (
        db.query(SalesInvoiceHdr)
        .options(joinedload(SalesInvoiceHdr.lines))
        .filter(SalesInvoiceHdr.invoice_no == invoice_no)
        .first()
    )

    if not obj:
        raise HTTPException(status_code=404, detail="Sales invoice not found")

    if has_any_receipt(db, invoice_no):
        raise HTTPException(
            status_code=400,
            detail="Invoice has receipt entries. It cannot be cancelled.",
        )

    old_values = {
        "invoice_no": obj.invoice_no,
        "status": obj.status,
        "balance": float(obj.balance),
        "remark": obj.remark,
    }

    obj.status = STATUS_CANCELLED
    obj.balance = Decimal("0.00")
    obj.remark = normalize_upper(payload.remark) if payload.remark else obj.remark

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.UPDATE,
        module=AuditModule.SALES_INVOICE,
        record_id=obj.invoice_no,
        record_name=obj.invoice_no,
        details=f"Sales invoice cancelled: {obj.invoice_no}",
        old_values=old_values,
        new_values={
            "invoice_no": obj.invoice_no,
            "status": obj.status,
            "balance": float(obj.balance),
            "remark": obj.remark,
        },
    )

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{invoice_no}")
def delete_sales_invoice(
    invoice_no: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    invoice_no = invoice_no.strip().upper()

    obj = (
        db.query(SalesInvoiceHdr)
        .filter(SalesInvoiceHdr.invoice_no == invoice_no)
        .first()
    )

    if not obj:
        raise HTTPException(status_code=404, detail="Sales invoice not found")

    if has_any_receipt(db, invoice_no):
        raise HTTPException(
            status_code=400,
            detail="Invoice has receipt entries. It cannot be deleted.",
        )

    old_values = {
        "invoice_no": obj.invoice_no,
        "invoice_template": obj.invoice_template,
        "customer_code": obj.customer_code,
        "invoice_date": str(obj.invoice_date),
        "due_date": str(obj.due_date) if obj.due_date else None,
        "grand_total": float(obj.grand_total),
        "balance": float(obj.balance),
        "status": obj.status,
    }

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.DELETE,
        module=AuditModule.SALES_INVOICE,
        record_id=obj.invoice_no,
        record_name=obj.invoice_no,
        details=f"Sales invoice deleted: {obj.invoice_no}",
        old_values=old_values,
    )

    db.delete(obj)
    db.commit()

    return {"ok": True, "deleted": invoice_no}