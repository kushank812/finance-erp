# app/api/dashboard.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.sales_invoice import SalesInvoiceHdr
from app.models.purchase_invoice import PurchaseInvoiceHdr

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    # ---- AR (Sales) ----
    receivables_total = (
        db.query(func.coalesce(func.sum(SalesInvoiceHdr.grand_total), 0))
        .scalar()
    )

    overdue_receivables = (
        db.query(func.coalesce(func.sum(SalesInvoiceHdr.balance), 0))
        .filter(SalesInvoiceHdr.status == "Overdue")
        .scalar()
    )

    # ---- AP (Purchase) ----
    payables_total = (
        db.query(func.coalesce(func.sum(PurchaseInvoiceHdr.grand_total), 0))
        .scalar()
    )

    overdue_payables = (
        db.query(func.coalesce(func.sum(PurchaseInvoiceHdr.balance), 0))
        .filter(PurchaseInvoiceHdr.status == "Overdue")
        .scalar()
    )

    return {
        "receivables": float(receivables_total or 0),
        "payables": float(payables_total or 0),
        "overdue_receivables": float(overdue_receivables or 0),
        "overdue_payables": float(overdue_payables or 0),
    }