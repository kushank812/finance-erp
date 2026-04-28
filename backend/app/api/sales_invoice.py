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
from app.models.journal_voucher import JournalVoucherDtl, JournalVoucherHdr
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

ALLOWED_INVOICE_TEMPLATES = {"STANDARD", "TAX_INVOICE", "SERVICE_INVOICE"}


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
    description: str | None = None
    hsn_sac: str | None = None
    unit: str | None = None
    work_period: str | None = None
    qty: float = Field(gt=0)
    rate: float = Field(ge=0)
    line_tax_percent: float | None = 0


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


def clean_text(value):
    if value is None:
        return None

    text = str(value).strip()
    if not text:
        return None

    return normalize_upper(text)


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


def calculate_line_values(invoice_template: str, qty: Decimal, rate: Decimal, line_tax_percent: Decimal):
    base_amount = qty * rate

    if invoice_template == "TAX_INVOICE":
        line_tax_amount = (base_amount * line_tax_percent) / Decimal("100")
    else:
        line_tax_amount = Decimal("0.00")

    return base_amount, line_tax_amount


def status_after_balance(grand_total, amount_done, adjusted_amount, due_date, balance):
    if to_decimal(balance) < 0:
        return "CREDIT"
    return compute_status(
        grand_total=grand_total,
        amount_done=amount_done,
        adjusted_amount=adjusted_amount,
        balance=balance,
        due_date=due_date,
        cancelled=False,
    )


def build_excess_receipt_jv(voucher_no: str, invoice: SalesInvoiceHdr, excess_amount: Decimal, narration: str | None) -> JournalVoucherHdr:
    final_narration = narration or "EXCESS RECEIPT TRANSFERRED TO CUSTOMER ADVANCE"
    return JournalVoucherHdr(
        voucher_no=voucher_no,
        voucher_date=date.today(),
        voucher_kind="ADJUSTMENT",
        reference_type="SALES_INVOICE",
        reference_no=invoice.invoice_no,
        party_code=invoice.customer_code,
        amount=excess_amount,
        reason_code="EXCESS_RECEIPT_ADJUSTMENT",
        narration=final_narration,
        status="POSTED",
        lines=[
            JournalVoucherDtl(line_no=1, account_name="TRADE RECEIVABLES", debit_amount=excess_amount, credit_amount=Decimal("0"), remark=final_narration),
            JournalVoucherDtl(line_no=2, account_name="CUSTOMER ADVANCE / EXCESS RECEIPT", debit_amount=Decimal("0"), credit_amount=excess_amount, remark=final_narration),
        ],
    )


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
    data = payload.model_dump()

    try:
        invoice_no = get_next_number(db, "SALES_INVOICE", "INV")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    customer_code = normalize_upper(data["customer_code"])
    invoice_template = normalize_template(data.get("invoice_template"))
    invoice_date = data["invoice_date"]
    due_date = data.get("due_date")
    tax_percent = to_decimal(data.get("tax_percent"))
    remark = clean_text(data.get("remark"))
    lines = data.get("lines", [])

    if tax_percent < 0:
        raise HTTPException(status_code=400, detail="Tax percent cannot be negative")

    if not lines:
        raise HTTPException(status_code=400, detail="At least one line is required")

    subtotal = Decimal("0.00")
    tax_amount = Decimal("0.00")
    dtl_rows: list[SalesInvoiceDtl] = []

    for index, ln in enumerate(lines, start=1):
        item_code = normalize_upper(ln.get("item_code"))
        description = clean_text(ln.get("description"))
        hsn_sac = clean_text(ln.get("hsn_sac"))
        unit = clean_text(ln.get("unit"))
        work_period = clean_text(ln.get("work_period"))

        qty = to_decimal(ln.get("qty"))
        rate = to_decimal(ln.get("rate"))
        line_tax_percent = to_decimal(ln.get("line_tax_percent"))

        if not item_code:
            raise HTTPException(status_code=400, detail=f"Line {index}: Item is required")

        if qty <= 0:
            raise HTTPException(status_code=400, detail=f"Line {index}: Qty must be greater than 0")

        if rate < 0:
            raise HTTPException(status_code=400, detail=f"Line {index}: Rate cannot be negative")

        if line_tax_percent < 0:
            raise HTTPException(status_code=400, detail=f"Line {index}: Tax percent cannot be negative")

        if invoice_template != "TAX_INVOICE":
            line_tax_percent = Decimal("0.00")
            hsn_sac = None
            unit = None

        if invoice_template != "SERVICE_INVOICE":
            work_period = None

        line_total, line_tax_amount = calculate_line_values(
            invoice_template=invoice_template,
            qty=qty,
            rate=rate,
            line_tax_percent=line_tax_percent,
        )

        subtotal += line_total
        tax_amount += line_tax_amount

        dtl_rows.append(
            SalesInvoiceDtl(
                invoice_no=invoice_no,
                item_code=item_code,
                description=description,
                hsn_sac=hsn_sac,
                unit=unit,
                work_period=work_period,
                qty=qty,
                rate=rate,
                line_tax_percent=line_tax_percent,
                line_tax_amount=line_tax_amount,
                line_total=line_total,
            )
        )

    if invoice_template != "TAX_INVOICE":
        tax_amount = (subtotal * tax_percent) / Decimal("100")
    else:
        tax_percent = Decimal("0.00")

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
        obj.remark = clean_text(payload.remark)
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
    obj.remark = clean_text(payload.remark)

    if obj.tax_percent < 0:
        raise HTTPException(status_code=400, detail="Tax percent cannot be negative")

    if not payload.lines:
        raise HTTPException(status_code=400, detail="At least one line is required")

    obj.lines.clear()
    db.flush()

    subtotal = Decimal("0.00")
    tax_amount = Decimal("0.00")

    for index, ln in enumerate(payload.lines, start=1):
        item_code = normalize_upper(ln.item_code)
        description = clean_text(ln.description)
        hsn_sac = clean_text(ln.hsn_sac)
        unit = clean_text(ln.unit)
        work_period = clean_text(ln.work_period)

        qty = to_decimal(ln.qty)
        rate = to_decimal(ln.rate)
        line_tax_percent = to_decimal(ln.line_tax_percent)

        if not item_code:
            raise HTTPException(status_code=400, detail=f"Line {index}: Item is required")

        if qty <= 0:
            raise HTTPException(status_code=400, detail=f"Line {index}: Qty must be greater than 0")

        if rate < 0:
            raise HTTPException(status_code=400, detail=f"Line {index}: Rate cannot be negative")

        if line_tax_percent < 0:
            raise HTTPException(status_code=400, detail=f"Line {index}: Tax percent cannot be negative")

        if obj.invoice_template != "TAX_INVOICE":
            line_tax_percent = Decimal("0.00")
            hsn_sac = None
            unit = None

        if obj.invoice_template != "SERVICE_INVOICE":
            work_period = None

        line_total, line_tax_amount = calculate_line_values(
            invoice_template=obj.invoice_template,
            qty=qty,
            rate=rate,
            line_tax_percent=line_tax_percent,
        )

        subtotal += line_total
        tax_amount += line_tax_amount

        obj.lines.append(
            SalesInvoiceDtl(
                invoice_no=obj.invoice_no,
                item_code=item_code,
                description=description,
                hsn_sac=hsn_sac,
                unit=unit,
                work_period=work_period,
                qty=qty,
                rate=rate,
                line_tax_percent=line_tax_percent,
                line_tax_amount=line_tax_amount,
                line_total=line_total,
            )
        )

    if obj.invoice_template != "TAX_INVOICE":
        tax_amount = (subtotal * obj.tax_percent) / Decimal("100")
    else:
        obj.tax_percent = Decimal("0.00")

    obj.subtotal = subtotal
    obj.tax_amount = tax_amount
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

    obj = db.query(SalesInvoiceHdr).filter(SalesInvoiceHdr.invoice_no == invoice_no).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Sales invoice not found")

    normalize_invoice_status(obj)

    if obj.status == STATUS_CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot receive against cancelled invoice")

    amount = to_decimal(payload.amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Receipt amount must be greater than 0")

    current_balance = to_decimal(compute_balance(obj.grand_total, obj.amount_received, obj.adjusted_amount))
    old_amount_received = to_decimal(obj.amount_received)
    old_adjusted_amount = to_decimal(obj.adjusted_amount)
    old_balance = to_decimal(obj.balance)
    old_status = obj.status

    excess_amount = Decimal("0.00")
    if amount > current_balance:
        excess_amount = amount - current_balance

    try:
        receipt_no = get_next_number(db, "SALES_RECEIPT", "REC")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    receipt = SalesReceipt(
        receipt_no=receipt_no,
        invoice_no=obj.invoice_no,
        receipt_date=date.today(),
        amount=amount,
        remark=clean_text(payload.remark),
    )
    db.add(receipt)

    jv = None
    if excess_amount > 0:
        try:
            voucher_no = get_next_number(db, "JOURNAL_VOUCHER", "JV", 4)
        except ValueError as e:
            raise HTTPException(status_code=500, detail=str(e))
        jv = build_excess_receipt_jv(
            voucher_no=voucher_no,
            invoice=obj,
            excess_amount=excess_amount,
            narration=clean_text(payload.remark),
        )
        db.add(jv)

    obj.amount_received = old_amount_received + amount
    if excess_amount > 0:
        obj.balance = current_balance - amount
        obj.status = "CREDIT"
    else:
        obj.balance = compute_balance(obj.grand_total, obj.amount_received, obj.adjusted_amount)
        obj.status = status_after_balance(
            obj.grand_total,
            amount_done=obj.amount_received,
            adjusted_amount=obj.adjusted_amount,
            due_date=obj.due_date,
            balance=obj.balance,
        )

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.CREATE,
        module=AuditModule.RECEIPT,
        record_id=receipt.receipt_no,
        record_name=receipt.receipt_no,
        details=(
            f"Receipt created: {receipt.receipt_no} for invoice {obj.invoice_no}"
            + (f" with excess JV {jv.voucher_no}" if jv else "")
        ),
        old_values={
            "invoice_no": obj.invoice_no,
            "amount_received": float(old_amount_received),
            "adjusted_amount": float(old_adjusted_amount),
            "balance": float(old_balance),
            "status": old_status,
        },
        new_values={
            "receipt_no": receipt.receipt_no,
            "invoice_no": obj.invoice_no,
            "receipt_date": str(receipt.receipt_date),
            "receipt_amount": float(receipt.amount),
            "excess_amount": float(excess_amount),
            "excess_jv_no": jv.voucher_no if jv else None,
            "amount_received": float(obj.amount_received),
            "adjusted_amount": float(obj.adjusted_amount or 0),
            "balance": float(obj.balance),
            "status": obj.status,
            "remark": receipt.remark,
        },
    )

    if jv:
        log_activity(
            db=db,
            request=request,
            user_id=current_user.user_id,
            action=AuditAction.CREATE,
            module=AuditModule.JOURNAL_VOUCHER,
            record_id=jv.voucher_no,
            record_name=jv.voucher_no,
            details=f"Excess receipt JV created for invoice {obj.invoice_no}",
            old_values=None,
            new_values={
                "voucher_no": jv.voucher_no,
                "voucher_date": str(jv.voucher_date),
                "voucher_kind": jv.voucher_kind,
                "reference_type": jv.reference_type,
                "reference_no": jv.reference_no,
                "party_code": jv.party_code,
                "amount": float(jv.amount or 0),
                "reason_code": jv.reason_code,
                "narration": jv.narration,
                "status": jv.status,
            },
        )

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(e.orig) if getattr(e, "orig", None) else "Could not save receipt due to a conflicting change")

    db.refresh(receipt)
    db.refresh(obj)
    return ReceiptCreatedOut(ok=True, receipt_no=receipt.receipt_no, invoice_no=obj.invoice_no, receipt_date=str(receipt.receipt_date), amount=float(receipt.amount), remark=receipt.remark)


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
    obj.remark = clean_text(payload.remark) if payload.remark else obj.remark

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

    obj = db.query(SalesInvoiceHdr).filter(SalesInvoiceHdr.invoice_no == invoice_no).first()

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