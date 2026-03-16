from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.vendor_payment import VendorPayment

router = APIRouter(prefix="/vendor-payments", tags=["Vendor Payments"])


class VendorPaymentOut(BaseModel):
    payment_no: str
    payment_date: Optional[date] = None
    bill_no: str
    amount: Decimal
    remark: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/", response_model=list[VendorPaymentOut])
def list_vendor_payments(db: Session = Depends(get_db)):
    rows = (
        db.query(VendorPayment)
        .order_by(VendorPayment.payment_date.desc(), VendorPayment.payment_no.desc())
        .all()
    )
    return rows


@router.get("/{payment_no}", response_model=VendorPaymentOut)
def get_vendor_payment(payment_no: str, db: Session = Depends(get_db)):
    payment = (
        db.query(VendorPayment)
        .filter(VendorPayment.payment_no == payment_no)
        .first()
    )
    if not payment:
        raise HTTPException(status_code=404, detail="Vendor payment not found")
    return payment