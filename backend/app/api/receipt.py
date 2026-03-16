from decimal import Decimal
from typing import Optional
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.sales_invoice import SalesInvoiceHdr

router = APIRouter(prefix="/sales-invoices", tags=["Receipts"])


class ReceiptIn(BaseModel):
    amount: Decimal = Field(..., gt=0)
    remark: Optional[str] = None


class SalesInvoiceReceiptOut(BaseModel):
    invoice_no: str
    customer_code: Optional[str] = None
    invoice_date: Optional[date] = None
    grand_total: Decimal
    amount_received: Decimal
    balance: Decimal
    remark: Optional[str] = None

    class Config:
        from_attributes = True


@router.post("/{invoice_no}/receive")
def receive_payment(invoice_no: str, payload: ReceiptIn, db: Session = Depends(get_db)):
    invoice = (
        db.query(SalesInvoiceHdr)
        .filter(SalesInvoiceHdr.invoice_no == invoice_no)
        .first()
    )

    if not invoice:
        raise HTTPException(status_code=404, detail="Sales invoice not found")

    grand_total = Decimal(str(invoice.grand_total or 0))
    amount_received = Decimal(str(invoice.amount_received or 0))
    balance = Decimal(
        str(invoice.balance if invoice.balance is not None else (grand_total - amount_received))
    )
    receive_amount = Decimal(str(payload.amount))

    if receive_amount <= 0:
        raise HTTPException(status_code=400, detail="Received amount must be greater than 0")

    if receive_amount > balance:
        raise HTTPException(
            status_code=400,
            detail=f"Receipt amount cannot exceed invoice balance. Balance is {balance:.2f}"
        )

    new_received = amount_received + receive_amount
    new_balance = grand_total - new_received

    invoice.amount_received = new_received
    invoice.balance = new_balance
    invoice.remark = payload.remark.strip().upper() if payload.remark else None

    db.add(invoice)
    db.commit()
    db.refresh(invoice)

    return {
        "message": "Receipt saved successfully",
        "invoice_no": invoice.invoice_no,
        "amount_received": float(invoice.amount_received or 0),
        "balance": float(invoice.balance or 0),
    }