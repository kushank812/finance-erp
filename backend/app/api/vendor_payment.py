from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.purchase_invoice import VendorPayment

router = APIRouter(prefix="/vendor-payments", tags=["Vendor Payments"])


@router.get("/{payment_no}")
def get_vendor_payment(payment_no: str, db: Session = Depends(get_db)):
    obj = db.get(VendorPayment, payment_no)

    if not obj:
        raise HTTPException(status_code=404, detail="Vendor payment not found")

    return {
        "payment_no": obj.payment_no,
        "bill_no": obj.bill_no,
        "payment_date": obj.payment_date,
        "amount": obj.amount,
        "remark": obj.remark,
    }