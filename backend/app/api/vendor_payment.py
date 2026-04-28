from datetime import date
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.auth import require_viewer_or_above
from app.core.database import get_db
from app.models.user import User
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
def list_vendor_payments(
    q: str | None = Query(default=None),
    bill_no: str | None = Query(default=None),
    from_date: date | None = Query(default=None),
    to_date: date | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    query = db.query(VendorPayment)

    if q and q.strip():
        search = q.strip().upper()
        query = query.filter(
            or_(
                VendorPayment.payment_no.ilike(f"%{search}%"),
                VendorPayment.bill_no.ilike(f"%{search}%"),
                VendorPayment.remark.ilike(f"%{search}%"),
            )
        )

    if bill_no and bill_no.strip():
        query = query.filter(VendorPayment.bill_no == bill_no.strip().upper())

    if from_date:
        query = query.filter(VendorPayment.payment_date >= from_date)

    if to_date:
        query = query.filter(VendorPayment.payment_date <= to_date)

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
    current_user: User = Depends(require_viewer_or_above),
):
    payment_no = payment_no.strip().upper()

    payment = (
        db.query(VendorPayment)
        .filter(VendorPayment.payment_no == payment_no)
        .first()
    )

    if not payment:
        raise HTTPException(status_code=404, detail="Vendor payment not found")

    return payment