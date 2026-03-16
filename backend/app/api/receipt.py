from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.sales_invoice import SalesReceipt

router = APIRouter(prefix="/receipts", tags=["Receipts"])


@router.get("/{receipt_no}")
def get_receipt(receipt_no: str, db: Session = Depends(get_db)):
    obj = db.get(SalesReceipt, receipt_no)

    if not obj:
        raise HTTPException(status_code=404, detail="Receipt not found")

    return {
        "receipt_no": obj.receipt_no,
        "invoice_no": obj.invoice_no,
        "receipt_date": obj.receipt_date,
        "amount": obj.amount,
        "remark": obj.remark,
    }