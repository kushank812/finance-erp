from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.auth import require_operator_or_admin, require_viewer_or_above
from app.core.database import get_db
from app.models.sales_invoice import SalesInvoiceDtl, SalesInvoiceHdr, SalesReceipt
from app.models.user import User
from app.schemas.sales_invoice import SalesInvoiceCreate, SalesInvoiceOut
from app.utils.audit import log_activity
from app.utils.audit_constants import AuditAction, AuditModule
from app.utils.numbering import get_next_number
from app.utils.text import normalize_upper

router = APIRouter(prefix="/sales-invoices", tags=["Sales Invoices"])


# -----------------------------
# INPUT / OUTPUT MODELS
# -----------------------------
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
    invoice_date: date
    due_date: date | None = None
    customer_code: str
    tax_percent: float = 0
    remark: str | None = None
    lines: list[SalesInvoiceLineUpdateIn]


class CancelInvoiceIn(BaseModel):
    remark: str | None = None


# -----------------------------
# STATUS HELPERS
# -----------------------------
STATUS_PENDING = "PENDING"
STATUS_PARTIAL = "PARTIAL"
STATUS_PAID = "PAID"
STATUS_OVERDUE = "OVERDUE"
STATUS_CANCELLED = "CANCELLED"


def compute_status(
    balance: Decimal | float,
    grand_total: Decimal | float,
    due_date: date | None,
) -> str:
    bal = Decimal(str(balance or 0))
    total = Decimal(str(grand_total or 0))

    if bal <= 0:
        return STATUS_PAID
    if bal < total:
        return STATUS_PARTIAL
    if due_date and date.today() > due_date:
        return STATUS_OVERDUE
    return STATUS_PENDING


def to_decimal(value) -> Decimal:
    return Decimal(str(value or 0))


def normalize_invoice_status(obj: SalesInvoiceHdr) -> SalesInvoiceHdr:
    if str(obj.status or "").upper() == STATUS_CANCELLED:
        obj.status = STATUS_CANCELLED
    else:
        obj.status = compute_status(obj.balance, obj.grand_total, obj.due_date)
    return obj


def has_any_receipt(db: Session, invoice_no: str) -> bool:
    receipt = (
        db.query(SalesReceipt.receipt_no)
        .filter(SalesReceipt.invoice_no == invoice_no)
        .first()
    )
    return receipt is not None


# -----------------------------
# LIST INVOICES
# -----------------------------
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


# -----------------------------
# GET SINGLE INVOICE
# -----------------------------
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


# -----------------------------
# CREATE INVOICE
# -----------------------------
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
    invoice_date = data["invoice_date"]
    due_date = data.get("due_date")
    tax_percent = to_decimal(data.get("tax_percent"))
    remark = data.get("remark")
    lines = data.get("lines", [])

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
    balance = grand_total
    status = compute_status(balance, grand_total, due_date)

    hdr = SalesInvoiceHdr(
        invoice_no=invoice_no,
        invoice_date=invoice_date,
        due_date=due_date,
        customer_code=customer_code,
        subtotal=subtotal,
        tax_percent=tax_percent,
        tax_amount=tax_amount,
        grand_total=grand_total,
        amount_received=amount_received,
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
            "customer_code": hdr.customer_code,
            "invoice_date": str(hdr.invoice_date),
            "due_date": str(hdr.due_date) if hdr.due_date else None,
            "subtotal": float(hdr.subtotal),
            "tax_percent": float(hdr.tax_percent),
            "tax_amount": float(hdr.tax_amount),
            "grand_total": float(hdr.grand_total),
            "amount_received": float(hdr.amount_received),
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


# -----------------------------
# UPDATE INVOICE
# -----------------------------
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

    if str(obj.status or "").upper() == STATUS_CANCELLED:
        raise HTTPException(status_code=400, detail="Cancelled invoice cannot be updated")

    if to_decimal(obj.amount_received) > 0:
        raise HTTPException(
            status_code=400,
            detail="Invoice with received payment cannot be updated",
        )

    data = normalize_upper(payload.model_dump())

    lines = data.get("lines", [])
    if not lines:
        raise HTTPException(status_code=400, detail="At least one line is required")

    old_values = {
        "invoice_date": str(obj.invoice_date),
        "due_date": str(obj.due_date) if obj.due_date else None,
        "customer_code": obj.customer_code,
        "subtotal": float(obj.subtotal or 0),
        "tax_percent": float(obj.tax_percent or 0),
        "tax_amount": float(obj.tax_amount or 0),
        "grand_total": float(obj.grand_total or 0),
        "amount_received": float(obj.amount_received or 0),
        "balance": float(obj.balance or 0),
        "status": obj.status,
        "remark": obj.remark,
        "line_count": len(obj.lines or []),
    }

    subtotal = Decimal("0.00")
    new_lines: list[SalesInvoiceDtl] = []

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
            SalesInvoiceDtl(
                invoice_no=obj.invoice_no,
                item_code=ln["item_code"],
                qty=qty,
                rate=rate,
                line_total=line_total,
            )
        )

    tax_percent = to_decimal(data.get("tax_percent"))
    tax_amount = (subtotal * tax_percent) / Decimal("100")
    grand_total = subtotal + tax_amount

    amount_received = to_decimal(obj.amount_received)
    balance = grand_total - amount_received

    if balance < 0:
        raise HTTPException(
            status_code=400,
            detail="Grand total cannot be less than amount already received",
        )

    obj.invoice_date = data["invoice_date"]
    obj.due_date = data.get("due_date")
    obj.customer_code = data["customer_code"]
    obj.tax_percent = tax_percent
    obj.tax_amount = tax_amount
    obj.subtotal = subtotal
    obj.grand_total = grand_total
    obj.balance = balance
    obj.remark = data.get("remark")
    obj.status = compute_status(obj.balance, obj.grand_total, obj.due_date)

    obj.lines.clear()
    for ln in new_lines:
        obj.lines.append(ln)

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
            "invoice_date": str(obj.invoice_date),
            "due_date": str(obj.due_date) if obj.due_date else None,
            "customer_code": obj.customer_code,
            "subtotal": float(obj.subtotal),
            "tax_percent": float(obj.tax_percent),
            "tax_amount": float(obj.tax_amount),
            "grand_total": float(obj.grand_total),
            "amount_received": float(obj.amount_received),
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
        raise HTTPException(status_code=409, detail=str(e.orig))

    db.refresh(obj)
    normalize_invoice_status(obj)
    return obj


# -----------------------------
# CANCEL INVOICE
# -----------------------------
@router.patch("/{invoice_no}/cancel", response_model=SalesInvoiceOut)
def cancel_sales_invoice(
    invoice_no: str,
    payload: CancelInvoiceIn | None = None,
    request: Request = None,
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

    if str(obj.status or "").upper() == STATUS_CANCELLED:
        raise HTTPException(status_code=400, detail="Invoice is already cancelled")

    if has_any_receipt(db, invoice_no) or to_decimal(obj.amount_received) > 0:
        raise HTTPException(
            status_code=400,
            detail="Reverse receipt(s) first before cancelling invoice",
        )

    old_values = {
        "status": obj.status,
        "remark": obj.remark,
    }

    cancel_remark = None
    if payload and payload.remark and str(payload.remark).strip():
        cancel_remark = str(payload.remark).strip().upper()

    obj.status = STATUS_CANCELLED
    obj.amount_received = Decimal("0.00")
    obj.balance = Decimal("0.00")

    if cancel_remark:
        obj.remark = cancel_remark

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
            "status": obj.status,
            "remark": obj.remark,
            "amount_received": float(obj.amount_received or 0),
            "balance": float(obj.balance or 0),
        },
    )

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(e.orig))

    db.refresh(obj)
    return obj


# -----------------------------
# DELETE INVOICE
# -----------------------------
@router.delete("/{invoice_no}")
def delete_sales_invoice(
    invoice_no: str,
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

    if has_any_receipt(db, invoice_no) or to_decimal(obj.amount_received) > 0:
        raise HTTPException(
            status_code=400,
            detail="Invoice has receipt(s). Reverse receipt(s) first before deleting",
        )

    old_values = {
        "invoice_no": obj.invoice_no,
        "customer_code": obj.customer_code,
        "invoice_date": str(obj.invoice_date),
        "due_date": str(obj.due_date) if obj.due_date else None,
        "subtotal": float(obj.subtotal or 0),
        "tax_percent": float(obj.tax_percent or 0),
        "tax_amount": float(obj.tax_amount or 0),
        "grand_total": float(obj.grand_total or 0),
        "amount_received": float(obj.amount_received or 0),
        "balance": float(obj.balance or 0),
        "status": obj.status,
        "remark": obj.remark,
        "line_count": len(obj.lines or []),
    }

    # delete detail lines first for safety
    db.query(SalesInvoiceDtl).filter(
        SalesInvoiceDtl.invoice_no == obj.invoice_no
    ).delete(synchronize_session=False)

    db.delete(obj)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.DELETE,
        module=AuditModule.SALES_INVOICE,
        record_id=invoice_no,
        record_name=invoice_no,
        details=f"Sales invoice deleted: {invoice_no}",
        old_values=old_values,
        new_values=None,
    )

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(e.orig))

    return {
        "ok": True,
        "message": f"Sales invoice {invoice_no} deleted successfully",
    }


# -----------------------------
# RECEIVE PAYMENT
# -----------------------------
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
        db.execute(
            select(SalesInvoiceHdr)
            .where(SalesInvoiceHdr.invoice_no == invoice_no)
            .with_for_update()
        )
        .scalar_one_or_none()
    )

    if not obj:
        raise HTTPException(status_code=404, detail="Sales invoice not found")

    if str(obj.status or "").upper() == STATUS_CANCELLED:
        raise HTTPException(
            status_code=400,
            detail="Cannot receive payment for cancelled invoice",
        )

    amount = Decimal(str(payload.amount or 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    current_balance = Decimal(str(obj.balance or 0))
    if amount > current_balance:
        raise HTTPException(
            status_code=400,
            detail="Received amount cannot exceed balance",
        )

    old_values = {
        "amount_received": float(obj.amount_received or 0),
        "balance": float(obj.balance or 0),
        "status": obj.status,
    }

    try:
        receipt_no = get_next_number(db, "RECEIPT", "RCT")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    receipt = SalesReceipt(
        receipt_no=receipt_no,
        invoice_no=obj.invoice_no,
        receipt_date=date.today(),
        amount=amount,
        remark=str(payload.remark).strip().upper()
        if payload.remark and str(payload.remark).strip()
        else None,
    )
    db.add(receipt)

    new_amount_received = Decimal(str(obj.amount_received or 0)) + amount
    new_balance = Decimal(str(obj.grand_total or 0)) - new_amount_received

    obj.amount_received = new_amount_received
    obj.balance = new_balance
    obj.status = compute_status(obj.balance, obj.grand_total, obj.due_date)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.CREATE,
        module=AuditModule.RECEIPT,
        record_id=receipt.receipt_no,
        record_name=receipt.receipt_no,
        details=f"Payment received for invoice {obj.invoice_no}",
        old_values=old_values,
        new_values={
            "receipt_no": receipt.receipt_no,
            "invoice_no": obj.invoice_no,
            "receipt_date": str(receipt.receipt_date),
            "amount": float(amount),
            "remark": receipt.remark,
            "amount_received": float(obj.amount_received),
            "balance": float(obj.balance),
            "status": obj.status,
        },
    )

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(e.orig))

    db.refresh(receipt)

    return ReceiptCreatedOut(
        ok=True,
        receipt_no=receipt.receipt_no,
        invoice_no=receipt.invoice_no,
        receipt_date=str(receipt.receipt_date),
        amount=float(receipt.amount),
        remark=receipt.remark,
    )