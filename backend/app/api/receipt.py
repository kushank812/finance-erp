from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.auth import require_operator_or_admin
from app.core.database import get_db
from app.models.sales_invoice import SalesInvoiceHdr, SalesReceipt
from app.models.user import User
from app.utils.audit import log_activity
from app.utils.audit_constants import AuditAction, AuditModule

router = APIRouter(prefix="/receipts", tags=["Receipts"])


def compute_status(balance, grand_total, due_date):
    from datetime import date

    bal = Decimal(str(balance or 0))
    total = Decimal(str(grand_total or 0))

    if bal <= 0:
        return "PAID"
    if bal < total:
        return "PARTIAL"
    if due_date and date.today() > due_date:
        return "OVERDUE"
    return "PENDING"


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

    old_values = {
        "receipt_no": receipt.receipt_no,
        "invoice_no": receipt.invoice_no,
        "amount": float(receipt.amount),
        "amount_received": float(invoice.amount_received),
        "balance": float(invoice.balance),
        "status": invoice.status,
    }

    # 🔥 reverse math
    invoice.amount_received = Decimal(str(invoice.amount_received)) - Decimal(str(receipt.amount))
    invoice.balance = Decimal(str(invoice.grand_total)) - Decimal(str(invoice.amount_received))
    invoice.status = compute_status(invoice.balance, invoice.grand_total, invoice.due_date)

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
            "amount_received": float(invoice.amount_received),
            "balance": float(invoice.balance),
            "status": invoice.status,
        },
    )

    db.commit()

    return {
        "ok": True,
        "message": f"Receipt {receipt_no} reversed successfully",
    }