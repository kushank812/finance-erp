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
from app.utils.status import compute_status, to_decimal

router = APIRouter(prefix="/journal-vouchers", tags=["Journal Vouchers"])


VALID_REASON_CODES = {
    "ROUND_OFF",
    "SHORT_RECEIPT_ADJUSTMENT",
    "SHORT_PAYMENT_ADJUSTMENT",
    "EXCESS_RECEIPT_ADJUSTMENT",
    "EXCESS_PAYMENT_ADJUSTMENT",
    "DISCOUNT_ALLOWED",
    "WRITE_OFF",
    "MANUAL_ADJUSTMENT",
}

VALID_DIRECTIONS = {
    "DECREASE",
    "INCREASE",
    "EXCESS",
}


class JournalVoucherAdjustIn(BaseModel):
    amount: float = Field(gt=0)
    reason_code: str = "MANUAL_ADJUSTMENT"
    direction: str = "DECREASE"
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


def _clean_direction(value: str | None) -> str:
    direction = str(value or "DECREASE").strip().upper()
    if direction not in VALID_DIRECTIONS:
        raise HTTPException(status_code=400, detail="Invalid adjustment direction")
    return direction


def _clean_narration(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip().upper()
    return text or None


def _raw_balance(grand_total, amount_done, adjusted_amount) -> Decimal:
    return (
        to_decimal(grand_total)
        - to_decimal(amount_done)
        - to_decimal(adjusted_amount)
    )


def _status_from_balance(grand_total, amount_done, adjusted_amount, due_date, balance):
    if to_decimal(balance) < 0:
        return "CREDIT"

    return compute_status(
        grand_total=grand_total,
        amount_done=amount_done,
        adjusted_amount=adjusted_amount,
        due_date=due_date,
        balance=balance,
        cancelled=False,
    )


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
        raise HTTPException(
            status_code=400,
            detail="Cancelled invoice cannot be adjusted",
        )

    amount = to_decimal(payload.amount)
    if amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Adjustment amount must be greater than 0",
        )

    reason_code = _clean_reason_code(payload.reason_code)
    direction = _clean_direction(payload.direction)
    narration = _clean_narration(payload.narration)

    current_balance = to_decimal(invoice.balance)

    if direction == "DECREASE" and amount > current_balance:
        raise HTTPException(
            status_code=400,
            detail="Reduce Balance adjustment cannot exceed current balance. Use Excess / Credit Adjustment for extra payment cases.",
        )

    try:
        voucher_no = get_next_number(db, "JOURNAL_VOUCHER", "JV", 4)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if direction == "DECREASE":
        lines = [
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
        ]
    elif direction == "INCREASE":
        lines = [
            JournalVoucherDtl(
                line_no=1,
                account_name="TRADE RECEIVABLES",
                debit_amount=amount,
                credit_amount=Decimal("0"),
                remark=narration,
            ),
            JournalVoucherDtl(
                line_no=2,
                account_name="ADJUSTMENT REVERSAL / CORRECTION",
                debit_amount=Decimal("0"),
                credit_amount=amount,
                remark=narration,
            ),
        ]
    else:
        lines = [
            JournalVoucherDtl(
                line_no=1,
                account_name="TRADE RECEIVABLES",
                debit_amount=amount,
                credit_amount=Decimal("0"),
                remark=narration,
            ),
            JournalVoucherDtl(
                line_no=2,
                account_name="CUSTOMER ADVANCE / EXCESS RECEIPT",
                debit_amount=Decimal("0"),
                credit_amount=amount,
                remark=narration,
            ),
        ]

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
        lines=lines,
    )

    db.add(jv)

    old_values = {
        "amount_received": float(invoice.amount_received or 0),
        "adjusted_amount": float(invoice.adjusted_amount or 0),
        "balance": float(invoice.balance or 0),
        "status": invoice.status,
    }

    existing_adjusted = to_decimal(invoice.adjusted_amount)

    if direction == "DECREASE":
        invoice.adjusted_amount = existing_adjusted + amount
    elif direction == "INCREASE":
        invoice.adjusted_amount = existing_adjusted - amount
    else:
        invoice.adjusted_amount = existing_adjusted + amount

    invoice.balance = _raw_balance(
        invoice.grand_total,
        invoice.amount_received,
        invoice.adjusted_amount,
    )

    invoice.status = _status_from_balance(
        grand_total=invoice.grand_total,
        amount_done=invoice.amount_received,
        adjusted_amount=invoice.adjusted_amount,
        due_date=invoice.due_date,
        balance=invoice.balance,
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
            "direction": direction,
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
            detail=str(e.orig)
            if getattr(e, "orig", None)
            else "Could not create journal voucher",
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
        raise HTTPException(
            status_code=400,
            detail="Cancelled bill cannot be adjusted",
        )

    amount = to_decimal(payload.amount)
    if amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Adjustment amount must be greater than 0",
        )

    reason_code = _clean_reason_code(payload.reason_code)
    direction = _clean_direction(payload.direction)
    narration = _clean_narration(payload.narration)

    current_balance = to_decimal(bill.balance)

    if direction == "DECREASE" and amount > current_balance:
        raise HTTPException(
            status_code=400,
            detail="Reduce Balance adjustment cannot exceed current balance. Use Excess / Credit Adjustment for extra payment cases.",
        )

    try:
        voucher_no = get_next_number(db, "JOURNAL_VOUCHER", "JV", 4)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if direction == "DECREASE":
        lines = [
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
        ]
    elif direction == "INCREASE":
        lines = [
            JournalVoucherDtl(
                line_no=1,
                account_name="ADJUSTMENT REVERSAL / CORRECTION",
                debit_amount=amount,
                credit_amount=Decimal("0"),
                remark=narration,
            ),
            JournalVoucherDtl(
                line_no=2,
                account_name="TRADE PAYABLES",
                debit_amount=Decimal("0"),
                credit_amount=amount,
                remark=narration,
            ),
        ]
    else:
        lines = [
            JournalVoucherDtl(
                line_no=1,
                account_name="VENDOR ADVANCE / EXCESS PAYMENT",
                debit_amount=amount,
                credit_amount=Decimal("0"),
                remark=narration,
            ),
            JournalVoucherDtl(
                line_no=2,
                account_name="TRADE PAYABLES",
                debit_amount=Decimal("0"),
                credit_amount=amount,
                remark=narration,
            ),
        ]

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
        lines=lines,
    )

    db.add(jv)

    old_values = {
        "amount_paid": float(bill.amount_paid or 0),
        "adjusted_amount": float(bill.adjusted_amount or 0),
        "balance": float(bill.balance or 0),
        "status": bill.status,
    }

    existing_adjusted = to_decimal(bill.adjusted_amount)

    if direction == "DECREASE":
        bill.adjusted_amount = existing_adjusted + amount
    elif direction == "INCREASE":
        bill.adjusted_amount = existing_adjusted - amount
    else:
        bill.adjusted_amount = existing_adjusted + amount

    bill.balance = _raw_balance(
        bill.grand_total,
        bill.amount_paid,
        bill.adjusted_amount,
    )

    bill.status = _status_from_balance(
        grand_total=bill.grand_total,
        amount_done=bill.amount_paid,
        adjusted_amount=bill.adjusted_amount,
        due_date=bill.due_date,
        balance=bill.balance,
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
            "direction": direction,
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
            detail=str(e.orig)
            if getattr(e, "orig", None)
            else "Could not create journal voucher",
        )

    db.refresh(jv)
    return jv