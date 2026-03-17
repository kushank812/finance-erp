from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import require_operator_or_admin
from app.core.database import get_db
from app.models.sales_invoice import SalesReceipt
from app.models.user import User

router = APIRouter(prefix="/receipts", tags=["Receipts"])


class ReceiptOut(BaseModel):
    receipt_no: str
    receipt_date: Optional[date] = None
    invoice_no: str
    amount: Decimal
    remark: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/", response_model=list[ReceiptOut])
def list_receipts(
    invoice_no: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    query = db.query(SalesReceipt)

    if invoice_no:
        query = query.filter(SalesReceipt.invoice_no == invoice_no.strip().upper())

    rows = (
        query.order_by(SalesReceipt.receipt_date.desc(), SalesReceipt.receipt_no.desc())
        .limit(limit)
        .all()
    )
    return rows


@router.get("/{receipt_no}", response_model=ReceiptOut)
def get_receipt(
    receipt_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    receipt = (
        db.query(SalesReceipt)
        .filter(SalesReceipt.receipt_no == receipt_no.strip().upper())
        .first()
    )
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return receipt