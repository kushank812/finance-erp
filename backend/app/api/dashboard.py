# app/api/dashboard.py
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.purchase_invoice import PurchaseInvoiceHdr
from app.models.sales_invoice import SalesInvoiceHdr, SalesReceipt
from app.models.vendor_payment import VendorPayment

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


STATUS_PENDING = "PENDING"
STATUS_PARTIAL = "PARTIAL"
STATUS_PAID = "PAID"
STATUS_OVERDUE = "OVERDUE"
STATUS_CANCELLED = "CANCELLED"


def scalar_number(value) -> float:
    return float(value or 0)


def scalar_count(value) -> int:
    return int(value or 0)


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    today = date.today()

    # -----------------------------
    # AR (Sales)
    # -----------------------------
    receivables_total = (
        db.query(func.coalesce(func.sum(SalesInvoiceHdr.grand_total), 0))
        .scalar()
    )

    overdue_receivables = (
        db.query(func.coalesce(func.sum(SalesInvoiceHdr.balance), 0))
        .filter(SalesInvoiceHdr.status == STATUS_OVERDUE)
        .scalar()
    )

    sales_invoice_count = (
        db.query(func.count(SalesInvoiceHdr.invoice_no))
        .scalar()
    )

    sales_pending_count = (
        db.query(func.count(SalesInvoiceHdr.invoice_no))
        .filter(SalesInvoiceHdr.status == STATUS_PENDING)
        .scalar()
    )

    sales_partial_count = (
        db.query(func.count(SalesInvoiceHdr.invoice_no))
        .filter(SalesInvoiceHdr.status == STATUS_PARTIAL)
        .scalar()
    )

    sales_paid_count = (
        db.query(func.count(SalesInvoiceHdr.invoice_no))
        .filter(SalesInvoiceHdr.status == STATUS_PAID)
        .scalar()
    )

    sales_overdue_count = (
        db.query(func.count(SalesInvoiceHdr.invoice_no))
        .filter(SalesInvoiceHdr.status == STATUS_OVERDUE)
        .scalar()
    )

    sales_cancelled_count = (
        db.query(func.count(SalesInvoiceHdr.invoice_no))
        .filter(SalesInvoiceHdr.status == STATUS_CANCELLED)
        .scalar()
    )

    today_receipts = (
        db.query(func.coalesce(func.sum(SalesReceipt.amount), 0))
        .filter(SalesReceipt.receipt_date == today)
        .scalar()
    )

    # -----------------------------
    # AP (Purchase)
    # -----------------------------
    payables_total = (
        db.query(func.coalesce(func.sum(PurchaseInvoiceHdr.grand_total), 0))
        .scalar()
    )

    overdue_payables = (
        db.query(func.coalesce(func.sum(PurchaseInvoiceHdr.balance), 0))
        .filter(PurchaseInvoiceHdr.status == STATUS_OVERDUE)
        .scalar()
    )

    purchase_bill_count = (
        db.query(func.count(PurchaseInvoiceHdr.bill_no))
        .scalar()
    )

    purchase_pending_count = (
        db.query(func.count(PurchaseInvoiceHdr.bill_no))
        .filter(PurchaseInvoiceHdr.status == STATUS_PENDING)
        .scalar()
    )

    purchase_partial_count = (
        db.query(func.count(PurchaseInvoiceHdr.bill_no))
        .filter(PurchaseInvoiceHdr.status == STATUS_PARTIAL)
        .scalar()
    )

    purchase_paid_count = (
        db.query(func.count(PurchaseInvoiceHdr.bill_no))
        .filter(PurchaseInvoiceHdr.status == STATUS_PAID)
        .scalar()
    )

    purchase_overdue_count = (
        db.query(func.count(PurchaseInvoiceHdr.bill_no))
        .filter(PurchaseInvoiceHdr.status == STATUS_OVERDUE)
        .scalar()
    )

    purchase_cancelled_count = (
        db.query(func.count(PurchaseInvoiceHdr.bill_no))
        .filter(PurchaseInvoiceHdr.status == STATUS_CANCELLED)
        .scalar()
    )

    today_vendor_payments = (
        db.query(func.coalesce(func.sum(VendorPayment.amount), 0))
        .filter(VendorPayment.payment_date == today)
        .scalar()
    )

    return {
        "receivables": scalar_number(receivables_total),
        "payables": scalar_number(payables_total),
        "overdue_receivables": scalar_number(overdue_receivables),
        "overdue_payables": scalar_number(overdue_payables),
        "today_receipts": scalar_number(today_receipts),
        "today_vendor_payments": scalar_number(today_vendor_payments),
        "sales_invoice_count": scalar_count(sales_invoice_count),
        "sales_pending_count": scalar_count(sales_pending_count),
        "sales_partial_count": scalar_count(sales_partial_count),
        "sales_paid_count": scalar_count(sales_paid_count),
        "sales_overdue_count": scalar_count(sales_overdue_count),
        "sales_cancelled_count": scalar_count(sales_cancelled_count),
        "purchase_bill_count": scalar_count(purchase_bill_count),
        "purchase_pending_count": scalar_count(purchase_pending_count),
        "purchase_partial_count": scalar_count(purchase_partial_count),
        "purchase_paid_count": scalar_count(purchase_paid_count),
        "purchase_overdue_count": scalar_count(purchase_overdue_count),
        "purchase_cancelled_count": scalar_count(purchase_cancelled_count),
    }