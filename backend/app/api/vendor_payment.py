from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.auth import require_operator_or_admin
from app.core.database import get_db
from app.models.vendor_payment import VendorPayment
from app.models.user import User

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
def list_vendor_payments(
    bill_no: str | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    query = db.query(VendorPayment)

    if bill_no:
        query = query.filter(VendorPayment.bill_no == bill_no.strip().upper())

    rows = (
        query.order_by(
            VendorPayment.payment_date.desc(),
            VendorPayment.payment_no.desc(),
        )
        .limit(limit)
        .all()
    )
    return rows


@router.get("/{payment_no}", response_model=VendorPaymentOut)
def get_vendor_payment(
    payment_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    payment = (
        db.query(VendorPayment)
        .filter(VendorPayment.payment_no == payment_no.strip().upper())
        .first()
    )

    if not payment:
        raise HTTPException(status_code=404, detail="Vendor payment not found")

    return payment