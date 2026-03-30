from datetime import date
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import func, extract
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.purchase_invoice import PurchaseInvoiceHdr
from app.models.sales_invoice import SalesInvoiceHdr, SalesReceipt
from app.models.vendor_payment import VendorPayment

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def scalar_number(value):
    return float(value or 0)


def scalar_count(value):
    return int(value or 0)


def classify_status(grand_total, balance, due_date, today):
    grand_total = float(grand_total or 0)
    balance = float(balance or 0)

    if balance <= 0:
        return "PAID"

    if 0 < balance < grand_total:
        return "PARTIAL"

    if due_date and due_date < today:
        return "OVERDUE"

    return "PENDING"


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    today = date.today()

    # ============================
    # OUTSTANDING TOTALS
    # ============================

    receivables_total = db.query(
        func.coalesce(func.sum(SalesInvoiceHdr.balance), 0)
    ).scalar()

    payables_total = db.query(
        func.coalesce(func.sum(PurchaseInvoiceHdr.balance), 0)
    ).scalar()

    # ============================
    # SALES / AR STATUS COUNTS
    # ============================

    sales_rows = db.query(
        SalesInvoiceHdr.invoice_no,
        SalesInvoiceHdr.grand_total,
        SalesInvoiceHdr.balance,
        SalesInvoiceHdr.due_date,
    ).all()

    sales_invoice_count = len(sales_rows)
    sales_pending_count = 0
    sales_partial_count = 0
    sales_paid_count = 0
    sales_overdue_count = 0
    sales_cancelled_count = 0

    overdue_receivables_total = 0.0

    for _, grand_total, balance, due_date in sales_rows:
        status = classify_status(grand_total, balance, due_date, today)

        if status == "PENDING":
            sales_pending_count += 1
        elif status == "PARTIAL":
            sales_partial_count += 1
        elif status == "PAID":
            sales_paid_count += 1
        elif status == "OVERDUE":
            sales_overdue_count += 1
            overdue_receivables_total += float(balance or 0)

    # ============================
    # PURCHASE / AP STATUS COUNTS
    # ============================

    purchase_rows = db.query(
        PurchaseInvoiceHdr.bill_no,
        PurchaseInvoiceHdr.grand_total,
        PurchaseInvoiceHdr.balance,
        PurchaseInvoiceHdr.due_date,
    ).all()

    purchase_bill_count = len(purchase_rows)
    purchase_pending_count = 0
    purchase_partial_count = 0
    purchase_paid_count = 0
    purchase_overdue_count = 0
    purchase_cancelled_count = 0

    overdue_payables_total = 0.0

    for _, grand_total, balance, due_date in purchase_rows:
        status = classify_status(grand_total, balance, due_date, today)

        if status == "PENDING":
            purchase_pending_count += 1
        elif status == "PARTIAL":
            purchase_partial_count += 1
        elif status == "PAID":
            purchase_paid_count += 1
        elif status == "OVERDUE":
            purchase_overdue_count += 1
            overdue_payables_total += float(balance or 0)

    # ============================
    # TODAY'S MOVEMENT
    # ============================

    today_receipts = db.query(
        func.coalesce(func.sum(SalesReceipt.amount), 0)
    ).filter(SalesReceipt.receipt_date == today).scalar()

    today_vendor_payments = db.query(
        func.coalesce(func.sum(VendorPayment.amount), 0)
    ).filter(VendorPayment.payment_date == today).scalar()

    # ============================
    # MONTHLY TREND
    # ============================

    def month_key(year, month):
        return f"{year}-{str(month).zfill(2)}"

    trend = defaultdict(
        lambda: {
            "receivables": 0,
            "payables": 0,
            "receipts": 0,
            "payments": 0,
        }
    )

    sales_trend_rows = db.query(
        extract("year", SalesInvoiceHdr.invoice_date),
        extract("month", SalesInvoiceHdr.invoice_date),
        func.sum(SalesInvoiceHdr.grand_total),
    ).group_by(
        extract("year", SalesInvoiceHdr.invoice_date),
        extract("month", SalesInvoiceHdr.invoice_date),
    ).all()

    for y, m, total in sales_trend_rows:
        key = month_key(int(y), int(m))
        trend[key]["receivables"] = float(total or 0)

    purchase_trend_rows = db.query(
        extract("year", PurchaseInvoiceHdr.bill_date),
        extract("month", PurchaseInvoiceHdr.bill_date),
        func.sum(PurchaseInvoiceHdr.grand_total),
    ).group_by(
        extract("year", PurchaseInvoiceHdr.bill_date),
        extract("month", PurchaseInvoiceHdr.bill_date),
    ).all()

    for y, m, total in purchase_trend_rows:
        key = month_key(int(y), int(m))
        trend[key]["payables"] = float(total or 0)

    receipt_trend_rows = db.query(
        extract("year", SalesReceipt.receipt_date),
        extract("month", SalesReceipt.receipt_date),
        func.sum(SalesReceipt.amount),
    ).group_by(
        extract("year", SalesReceipt.receipt_date),
        extract("month", SalesReceipt.receipt_date),
    ).all()

    for y, m, total in receipt_trend_rows:
        key = month_key(int(y), int(m))
        trend[key]["receipts"] = float(total or 0)

    payment_trend_rows = db.query(
        extract("year", VendorPayment.payment_date),
        extract("month", VendorPayment.payment_date),
        func.sum(VendorPayment.amount),
    ).group_by(
        extract("year", VendorPayment.payment_date),
        extract("month", VendorPayment.payment_date),
    ).all()

    for y, m, total in payment_trend_rows:
        key = month_key(int(y), int(m))
        trend[key]["payments"] = float(total or 0)

    monthly_trend = [{"month": k, **v} for k, v in sorted(trend.items())]

    # ============================
    # AGING BUCKETS
    # ============================

    invoice_aging_rows = db.query(
        SalesInvoiceHdr.due_date,
        SalesInvoiceHdr.balance,
    ).filter(SalesInvoiceHdr.balance > 0).all()

    aging = {
        "not_due": 0,
        "b0_30": 0,
        "b31_60": 0,
        "b61_90": 0,
        "b90_plus": 0,
    }

    for due_date, balance in invoice_aging_rows:
        bal = float(balance or 0)

        if not due_date:
            aging["not_due"] += bal
            continue

        days = (today - due_date).days

        if days <= 0:
            aging["not_due"] += bal
        elif days <= 30:
            aging["b0_30"] += bal
        elif days <= 60:
            aging["b31_60"] += bal
        elif days <= 90:
            aging["b61_90"] += bal
        else:
            aging["b90_plus"] += bal

    # ============================
    # TOP CUSTOMERS
    # ============================

    top_customers_rows = db.query(
        SalesInvoiceHdr.customer_code,
        func.sum(SalesInvoiceHdr.balance),
    ).filter(
        SalesInvoiceHdr.balance > 0
    ).group_by(
        SalesInvoiceHdr.customer_code
    ).order_by(
        func.sum(SalesInvoiceHdr.balance).desc()
    ).limit(7).all()

    top_customers = [
        {
            "customer_code": customer_code,
            "balance": float(balance or 0),
        }
        for customer_code, balance in top_customers_rows
    ]

    # ============================
    # FINAL RESPONSE
    # ============================

    return {
        "receivables": scalar_number(receivables_total),
        "payables": scalar_number(payables_total),
        "overdue_receivables": scalar_number(overdue_receivables_total),
        "overdue_payables": scalar_number(overdue_payables_total),
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

        "monthly_trend": monthly_trend,
        "aging_buckets": aging,
        "top_customers": top_customers,
    }