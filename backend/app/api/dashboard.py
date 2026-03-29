# app/api/dashboard.py
from datetime import date, datetime
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import func, extract
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


def scalar_number(value):
    return float(value or 0)


def scalar_count(value):
    return int(value or 0)


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    today = date.today()

    # ============================
    # BASIC SUMMARY (EXISTING)
    # ============================

    receivables_total = db.query(
        func.coalesce(func.sum(SalesInvoiceHdr.grand_total), 0)
    ).scalar()

    overdue_receivables = db.query(
        func.coalesce(func.sum(SalesInvoiceHdr.balance), 0)
    ).filter(SalesInvoiceHdr.status == STATUS_OVERDUE).scalar()

    sales_invoice_count = db.query(func.count(SalesInvoiceHdr.invoice_no)).scalar()

    sales_pending_count = db.query(func.count(SalesInvoiceHdr.invoice_no)).filter(
        SalesInvoiceHdr.status == STATUS_PENDING
    ).scalar()

    sales_partial_count = db.query(func.count(SalesInvoiceHdr.invoice_no)).filter(
        SalesInvoiceHdr.status == STATUS_PARTIAL
    ).scalar()

    sales_paid_count = db.query(func.count(SalesInvoiceHdr.invoice_no)).filter(
        SalesInvoiceHdr.status == STATUS_PAID
    ).scalar()

    sales_overdue_count = db.query(func.count(SalesInvoiceHdr.invoice_no)).filter(
        SalesInvoiceHdr.status == STATUS_OVERDUE
    ).scalar()

    sales_cancelled_count = db.query(func.count(SalesInvoiceHdr.invoice_no)).filter(
        SalesInvoiceHdr.status == STATUS_CANCELLED
    ).scalar()

    today_receipts = db.query(
        func.coalesce(func.sum(SalesReceipt.amount), 0)
    ).filter(SalesReceipt.receipt_date == today).scalar()

    payables_total = db.query(
        func.coalesce(func.sum(PurchaseInvoiceHdr.grand_total), 0)
    ).scalar()

    overdue_payables = db.query(
        func.coalesce(func.sum(PurchaseInvoiceHdr.balance), 0)
    ).filter(PurchaseInvoiceHdr.status == STATUS_OVERDUE).scalar()

    purchase_bill_count = db.query(func.count(PurchaseInvoiceHdr.bill_no)).scalar()

    purchase_pending_count = db.query(func.count(PurchaseInvoiceHdr.bill_no)).filter(
        PurchaseInvoiceHdr.status == STATUS_PENDING
    ).scalar()

    purchase_partial_count = db.query(func.count(PurchaseInvoiceHdr.bill_no)).filter(
        PurchaseInvoiceHdr.status == STATUS_PARTIAL
    ).scalar()

    purchase_paid_count = db.query(func.count(PurchaseInvoiceHdr.bill_no)).filter(
        PurchaseInvoiceHdr.status == STATUS_PAID
    ).scalar()

    purchase_overdue_count = db.query(func.count(PurchaseInvoiceHdr.bill_no)).filter(
        PurchaseInvoiceHdr.status == STATUS_OVERDUE
    ).scalar()

    purchase_cancelled_count = db.query(func.count(PurchaseInvoiceHdr.bill_no)).filter(
        PurchaseInvoiceHdr.status == STATUS_CANCELLED
    ).scalar()

    today_vendor_payments = db.query(
        func.coalesce(func.sum(VendorPayment.amount), 0)
    ).filter(VendorPayment.payment_date == today).scalar()

    # ============================
    # MONTHLY TREND (LAST 6 MONTHS)
    # ============================

    def month_key(year, month):
        return f"{year}-{str(month).zfill(2)}"

    trend = defaultdict(lambda: {
        "receivables": 0,
        "payables": 0,
        "receipts": 0,
        "payments": 0,
    })

    # SALES
    sales_rows = db.query(
        extract("year", SalesInvoiceHdr.invoice_date),
        extract("month", SalesInvoiceHdr.invoice_date),
        func.sum(SalesInvoiceHdr.grand_total)
    ).group_by(
        extract("year", SalesInvoiceHdr.invoice_date),
        extract("month", SalesInvoiceHdr.invoice_date)
    ).all()

    for y, m, total in sales_rows:
        key = month_key(int(y), int(m))
        trend[key]["receivables"] = float(total or 0)

    # PURCHASE
    purchase_rows = db.query(
        extract("year", PurchaseInvoiceHdr.bill_date),
        extract("month", PurchaseInvoiceHdr.bill_date),
        func.sum(PurchaseInvoiceHdr.grand_total)
    ).group_by(
        extract("year", PurchaseInvoiceHdr.bill_date),
        extract("month", PurchaseInvoiceHdr.bill_date)
    ).all()

    for y, m, total in purchase_rows:
        key = month_key(int(y), int(m))
        trend[key]["payables"] = float(total or 0)

    # RECEIPTS
    receipt_rows = db.query(
        extract("year", SalesReceipt.receipt_date),
        extract("month", SalesReceipt.receipt_date),
        func.sum(SalesReceipt.amount)
    ).group_by(
        extract("year", SalesReceipt.receipt_date),
        extract("month", SalesReceipt.receipt_date)
    ).all()

    for y, m, total in receipt_rows:
        key = month_key(int(y), int(m))
        trend[key]["receipts"] = float(total or 0)

    # PAYMENTS
    payment_rows = db.query(
        extract("year", VendorPayment.payment_date),
        extract("month", VendorPayment.payment_date),
        func.sum(VendorPayment.amount)
    ).group_by(
        extract("year", VendorPayment.payment_date),
        extract("month", VendorPayment.payment_date)
    ).all()

    for y, m, total in payment_rows:
        key = month_key(int(y), int(m))
        trend[key]["payments"] = float(total or 0)

    monthly_trend = [
        {"month": k, **v}
        for k, v in sorted(trend.items())
    ]

    # ============================
    # AGING BUCKETS
    # ============================

    invoices = db.query(
        SalesInvoiceHdr.due_date,
        SalesInvoiceHdr.balance
    ).filter(SalesInvoiceHdr.balance > 0).all()

    aging = {
        "not_due": 0,
        "b0_30": 0,
        "b31_60": 0,
        "b61_90": 0,
        "b90_plus": 0,
    }

    for due_date, balance in invoices:
        if not due_date:
            aging["not_due"] += balance
            continue

        days = (today - due_date).days

        if days <= 0:
            aging["not_due"] += balance
        elif days <= 30:
            aging["b0_30"] += balance
        elif days <= 60:
            aging["b31_60"] += balance
        elif days <= 90:
            aging["b61_90"] += balance
        else:
            aging["b90_plus"] += balance

    # ============================
    # TOP CUSTOMERS
    # ============================

    top_customers_rows = db.query(
        SalesInvoiceHdr.customer_code,
        func.sum(SalesInvoiceHdr.balance)
    ).filter(
        SalesInvoiceHdr.balance > 0
    ).group_by(
        SalesInvoiceHdr.customer_code
    ).order_by(
        func.sum(SalesInvoiceHdr.balance).desc()
    ).limit(7).all()

    top_customers = [
        {
            "customer_code": r[0],
            "balance": float(r[1] or 0)
        }
        for r in top_customers_rows
    ]

    # ============================
    # FINAL RESPONSE
    # ============================

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

        # NEW
        "monthly_trend": monthly_trend,
        "aging_buckets": aging,
        "top_customers": top_customers,
    }