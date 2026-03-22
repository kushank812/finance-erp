from datetime import date

from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_operator_or_admin, require_viewer_or_above
from app.core.database import get_db
from app.models.sales_invoice import SalesInvoiceHdr, SalesReceipt
from app.models.user import User
from app.utils.audit import log_activity
from app.utils.audit_constants import AuditAction, AuditModule

router = APIRouter(prefix="/receipts", tags=["Receipts"])


class ReceiptOut(BaseModel):
    receipt_no: str
    invoice_no: str
    receipt_date: date
    amount: float
    remark: str | None = None

    class Config:
        from_attributes = True


def compute_status(balance, grand_total, due_date):
    bal = Decimal(str(balance or 0))
    total = Decimal(str(grand_total or 0))

    if bal <= 0:
        return "PAID"
    if bal < total:
        return "PARTIAL"
    if due_date and date.today() > due_date:
        return "OVERDUE"
    return "PENDING"


@router.get("/", response_model=list[ReceiptOut])
def list_receipts(
    q: str | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    query = db.query(SalesReceipt)

    if q and q.strip():
        search = q.strip().upper()
        query = query.filter(
            or_(
                SalesReceipt.receipt_no.ilike(f"%{search}%"),
                SalesReceipt.invoice_no.ilike(f"%{search}%"),
            )
        )

    if from_date:
        query = query.filter(SalesReceipt.receipt_date >= from_date)

    if to_date:
        query = query.filter(SalesReceipt.receipt_date <= to_date)

    rows = query.order_by(
        SalesReceipt.receipt_date.desc(),
        SalesReceipt.receipt_no.desc(),
    ).all()

    return rows


@router.get("/{receipt_no}", response_model=ReceiptOut)
def get_receipt(
    receipt_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    receipt_no = receipt_no.strip().upper()

    obj = (
        db.query(SalesReceipt)
        .filter(SalesReceipt.receipt_no == receipt_no)
        .first()
    )

    if not obj:
        raise HTTPException(status_code=404, detail="Receipt not found")

    return obj


@router.delete("/{receipt_no}")
def reverse_receipt(
    receipt_no: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    receipt_no = receipt_no.strip().upper()

    receipt = (
        db.query(SalesReceipt)
        .filter(SalesReceipt.receipt_no == receipt_no)
        .first()
    )

    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    invoice = (
        db.query(SalesInvoiceHdr)
        .filter(SalesInvoiceHdr.invoice_no == receipt.invoice_no)
        .first()
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Linked invoice not found")

    reverse_amount = Decimal(str(receipt.amount or 0))
    current_amount_received = Decimal(str(invoice.amount_received or 0))
    current_grand_total = Decimal(str(invoice.grand_total or 0))

    if reverse_amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid receipt amount for reversal")

    if reverse_amount > current_amount_received:
        raise HTTPException(
            status_code=400,
            detail="Receipt reversal amount cannot exceed amount already received",
        )

    old_values = {
        "receipt_no": receipt.receipt_no,
        "invoice_no": receipt.invoice_no,
        "receipt_date": str(receipt.receipt_date),
        "amount": float(receipt.amount or 0),
        "remark": receipt.remark,
        "invoice_amount_received": float(invoice.amount_received or 0),
        "invoice_balance": float(invoice.balance or 0),
        "invoice_status": invoice.status,
    }

    new_amount_received = current_amount_received - reverse_amount
    new_balance = current_grand_total - new_amount_received

    if new_amount_received < 0:
        raise HTTPException(
            status_code=400,
            detail="Amount received cannot become negative after reversal",
        )

    invoice.amount_received = new_amount_received
    invoice.balance = new_balance
    invoice.status = compute_status(
        invoice.balance,
        invoice.grand_total,
        invoice.due_date,
    )

    db.delete(receipt)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.DELETE,
        module=AuditModule.RECEIPT,
        record_id=receipt_no,
        record_name=receipt_no,
        details=f"Receipt reversed: {receipt_no}",
        old_values=old_values,
        new_values={
            "invoice_no": invoice.invoice_no,
            "reversed_amount": float(reverse_amount),
            "invoice_amount_received": float(invoice.amount_received),
            "invoice_balance": float(invoice.balance),
            "invoice_status": invoice.status,
        },
    )

    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=str(e.orig) if getattr(e, "orig", None) else "Could not reverse receipt due to a conflicting change",
        )

    return {
        "ok": True,
        "message": f"Receipt {receipt_no} reversed successfully",
    }