# app/api/aging.py
from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.sales_invoice import SalesInvoiceHdr
from app.models.purchase_invoice import PurchaseInvoiceHdr

router = APIRouter(prefix="/aging", tags=["Aging"])


def bucketize(balance: float, due_date):
    if not due_date:
        return {"current": balance, "days_0_30": 0, "days_31_60": 0, "days_61_90": 0, "days_90_plus": 0}

    days_overdue = (date.today() - due_date).days

    if days_overdue <= 0:
        return {"current": balance, "days_0_30": 0, "days_31_60": 0, "days_61_90": 0, "days_90_plus": 0}
    if days_overdue <= 30:
        return {"current": 0, "days_0_30": balance, "days_31_60": 0, "days_61_90": 0, "days_90_plus": 0}
    if days_overdue <= 60:
        return {"current": 0, "days_0_30": 0, "days_31_60": balance, "days_61_90": 0, "days_90_plus": 0}
    if days_overdue <= 90:
        return {"current": 0, "days_0_30": 0, "days_31_60": 0, "days_61_90": balance, "days_90_plus": 0}

    return {"current": 0, "days_0_30": 0, "days_31_60": 0, "days_61_90": 0, "days_90_plus": balance}


@router.get("/ar")
def aging_ar(db: Session = Depends(get_db)):
    rows = (
        db.query(SalesInvoiceHdr)
        .filter(SalesInvoiceHdr.balance > 0)
        .order_by(SalesInvoiceHdr.invoice_date.desc())
        .all()
    )

    out = []
    for r in rows:
        buckets = bucketize(float(r.balance or 0), r.due_date)
        out.append({
            "party_code": r.customer_code,
            "doc_no": r.invoice_no,
            "doc_date": r.invoice_date,
            "due_date": r.due_date,
            "balance": float(r.balance or 0),
            "status": r.status,
            **buckets,
        })

    return out


@router.get("/ap")
def aging_ap(db: Session = Depends(get_db)):
    rows = (
        db.query(PurchaseInvoiceHdr)
        .filter(PurchaseInvoiceHdr.balance > 0)
        .order_by(PurchaseInvoiceHdr.bill_date.desc())
        .all()
    )

    out = []
    for r in rows:
        buckets = bucketize(float(r.balance or 0), r.due_date)
        out.append({
            "party_code": r.vendor_code,
            "doc_no": r.bill_no,
            "doc_date": r.bill_date,
            "due_date": r.due_date,
            "balance": float(r.balance or 0),
            "status": r.status,
            **buckets,
        })

    return out