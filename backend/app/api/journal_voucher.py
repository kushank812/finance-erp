from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_operator_or_admin, require_viewer_or_above
from app.core.database import get_db
from app.models.journal_voucher import JournalVoucherDtl, JournalVoucherHdr
from app.models.purchase_invoice import PurchaseInvoiceHdr
from app.models.sales_invoice import SalesInvoiceHdr
from app.models.user import User
from app.utils.audit import log_activity
from app.utils.audit_constants import AuditAction, AuditModule
from app.utils.numbering import get_next_number
from app.utils.status import compute_balance, compute_status, to_decimal

router = APIRouter(prefix="/journal-vouchers", tags=["Journal Vouchers"])


VALID_REASON_CODES = {
    "ROUND_OFF",
    "SHORT_RECEIPT_ADJUSTMENT",
    "SHORT_PAYMENT_ADJUSTMENT",
    "DISCOUNT_ALLOWED",
    "WRITE_OFF",
    "MANUAL_ADJUSTMENT",
}


class JournalVoucherAdjustIn(BaseModel):
    amount: float = Field(gt=0)
    reason_code: str = "MANUAL_ADJUSTMENT"
    narration: str | None = None


class JournalVoucherOut(BaseModel):
    voucher_no: str
    voucher_date: date
    voucher_kind: str
    reference_type: str
    reference_no: str
    party_code: str | None = None
    amount: float
    reason_code: str
    narration: str | None = None
    status: str

    class Config:
        from_attributes = True


def _clean_reason_code(value: str | None) -> str:
    code = str(value or "MANUAL_ADJUSTMENT").strip().upper()
    if code not in VALID_REASON_CODES:
        raise HTTPException(status_code=400, detail="Invalid reason code")
    return code


def _clean_narration(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip().upper()
    return text or None


def _snapshot_jv(obj: JournalVoucherHdr) -> dict:
    return {
        "voucher_no": obj.voucher_no,
        "voucher_date": str(obj.voucher_date),
        "voucher_kind": obj.voucher_kind,
        "reference_type": obj.reference_type,
        "reference_no": obj.reference_no,
        "party_code": obj.party_code,
        "amount": float(obj.amount or 0),
        "reason_code": obj.reason_code,
        "narration": obj.narration,
        "status": obj.status,
    }


@router.get("/", response_model=list[JournalVoucherOut])
def list_journal_vouchers(
    reference_type: str | None = Query(default=None),
    reference_no: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    query = db.query(JournalVoucherHdr)

    if reference_type and reference_type.strip():
        query = query.filter(
            JournalVoucherHdr.reference_type == reference_type.strip().upper()
        )

    if reference_no and reference_no.strip():
        query = query.filter(
            JournalVoucherHdr.reference_no == reference_no.strip().upper()
        )

    rows = query.order_by(
        JournalVoucherHdr.voucher_date.desc(),
        JournalVoucherHdr.voucher_no.desc(),
    ).all()

    return rows


@router.get("/{voucher_no}", response_model=JournalVoucherOut)
def get_journal_voucher(
    voucher_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    obj = (
        db.query(JournalVoucherHdr)
        .filter(JournalVoucherHdr.voucher_no == voucher_no.strip().upper())
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Journal voucher not found")
    return obj


@router.post("/adjust-sales-invoice/{invoice_no}", response_model=JournalVoucherOut)
def adjust_sales_invoice(
    invoice_no: str,
    payload: JournalVoucherAdjustIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    invoice_no = invoice_no.strip().upper()

    invoice = (
        db.execute(
            select(SalesInvoiceHdr)
            .where(SalesInvoiceHdr.invoice_no == invoice_no)
            .with_for_update()
        )
        .scalar_one_or_none()
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Sales invoice not found")

    if str(invoice.status or "").upper() == "CANCELLED":
        raise HTTPException(status_code=400, detail="Cancelled invoice cannot be adjusted")

    amount = to_decimal(payload.amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Adjustment amount must be greater than 0")

    current_balance = to_decimal(invoice.balance)
    if amount > current_balance:
        raise HTTPException(status_code=400, detail="Adjustment amount cannot exceed balance")

    reason_code = _clean_reason_code(payload.reason_code)
    narration = _clean_narration(payload.narration)

    try:
        voucher_no = get_next_number(db, "JOURNAL_VOUCHER", "JV", 4)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    jv = JournalVoucherHdr(
        voucher_no=voucher_no,
        voucher_date=date.today(),
        voucher_kind="ADJUSTMENT",
        reference_type="SALES_INVOICE",
        reference_no=invoice.invoice_no,
        party_code=invoice.customer_code,
        amount=amount,
        reason_code=reason_code,
        narration=narration,
        status="POSTED",
        lines=[
            JournalVoucherDtl(
                line_no=1,
                account_name="ADJUSTMENT EXPENSE / DISCOUNT / WRITE OFF",
                debit_amount=amount,
                credit_amount=Decimal("0"),
                remark=narration,
            ),
            JournalVoucherDtl(
                line_no=2,
                account_name="TRADE RECEIVABLES",
                debit_amount=Decimal("0"),
                credit_amount=amount,
                remark=narration,
            ),
        ],
    )
    db.add(jv)

    old_values = {
        "amount_received": float(invoice.amount_received or 0),
        "adjusted_amount": float(invoice.adjusted_amount or 0),
        "balance": float(invoice.balance or 0),
        "status": invoice.status,
    }

    new_adjusted_amount = to_decimal(invoice.adjusted_amount) + amount
    invoice.adjusted_amount = new_adjusted_amount
    invoice.balance = compute_balance(
        invoice.grand_total,
        invoice.amount_received,
        invoice.adjusted_amount,
    )
    invoice.status = compute_status(
        grand_total=invoice.grand_total,
        amount_done=invoice.amount_received,
        adjusted_amount=invoice.adjusted_amount,
        due_date=invoice.due_date,
        balance=invoice.balance,
        cancelled=False,
    )

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.CREATE,
        module=AuditModule.JOURNAL_VOUCHER,
        record_id=jv.voucher_no,
        record_name=jv.voucher_no,
        details=f"Journal voucher created for sales invoice {invoice.invoice_no}",
        old_values=old_values,
        new_values={
            **_snapshot_jv(jv),
            "invoice_no": invoice.invoice_no,
            "amount_received": float(invoice.amount_received or 0),
            "adjusted_amount": float(invoice.adjusted_amount or 0),
            "balance": float(invoice.balance or 0),
            "status": invoice.status,
        },
    )

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=str(e.orig) if getattr(e, "orig", None) else "Could not create journal voucher",
        )

    db.refresh(jv)
    return jv


@router.post("/adjust-purchase-bill/{bill_no}", response_model=JournalVoucherOut)
def adjust_purchase_bill(
    bill_no: str,
    payload: JournalVoucherAdjustIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    bill_no = bill_no.strip().upper()

    bill = (
        db.execute(
            select(PurchaseInvoiceHdr)
            .where(PurchaseInvoiceHdr.bill_no == bill_no)
            .with_for_update()
        )
        .scalar_one_or_none()
    )
    if not bill:
        raise HTTPException(status_code=404, detail="Purchase bill not found")

    if str(bill.status or "").upper() == "CANCELLED":
        raise HTTPException(status_code=400, detail="Cancelled bill cannot be adjusted")

    amount = to_decimal(payload.amount)
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Adjustment amount must be greater than 0")

    current_balance = to_decimal(bill.balance)
    if amount > current_balance:
        raise HTTPException(status_code=400, detail="Adjustment amount cannot exceed balance")

    reason_code = _clean_reason_code(payload.reason_code)
    narration = _clean_narration(payload.narration)

    try:
        voucher_no = get_next_number(db, "JOURNAL_VOUCHER", "JV", 4)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    jv = JournalVoucherHdr(
        voucher_no=voucher_no,
        voucher_date=date.today(),
        voucher_kind="ADJUSTMENT",
        reference_type="PURCHASE_BILL",
        reference_no=bill.bill_no,
        party_code=bill.vendor_code,
        amount=amount,
        reason_code=reason_code,
        narration=narration,
        status="POSTED",
        lines=[
            JournalVoucherDtl(
                line_no=1,
                account_name="TRADE PAYABLES",
                debit_amount=amount,
                credit_amount=Decimal("0"),
                remark=narration,
            ),
            JournalVoucherDtl(
                line_no=2,
                account_name="ADJUSTMENT INCOME / ROUND OFF / WRITE BACK",
                debit_amount=Decimal("0"),
                credit_amount=amount,
                remark=narration,
            ),
        ],
    )
    db.add(jv)

    old_values = {
        "amount_paid": float(bill.amount_paid or 0),
        "adjusted_amount": float(bill.adjusted_amount or 0),
        "balance": float(bill.balance or 0),
        "status": bill.status,
    }

    new_adjusted_amount = to_decimal(bill.adjusted_amount) + amount
    bill.adjusted_amount = new_adjusted_amount
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
        balance=bill.balance,
        cancelled=False,
    )

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.CREATE,
        module=AuditModule.JOURNAL_VOUCHER,
        record_id=jv.voucher_no,
        record_name=jv.voucher_no,
        details=f"Journal voucher created for purchase bill {bill.bill_no}",
        old_values=old_values,
        new_values={
            **_snapshot_jv(jv),
            "bill_no": bill.bill_no,
            "amount_paid": float(bill.amount_paid or 0),
            "adjusted_amount": float(bill.adjusted_amount or 0),
            "balance": float(bill.balance or 0),
            "status": bill.status,
        },
    )

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=str(e.orig) if getattr(e, "orig", None) else "Could not create journal voucher",
        )

    db.refresh(jv)
    return jv