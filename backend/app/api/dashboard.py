from datetime import date
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.purchase_invoice import PurchaseInvoiceHdr
from app.models.sales_invoice import SalesInvoiceHdr, SalesReceipt
from app.models.vendor_payment import VendorPayment
from app.utils.status import (
    STATUS_CANCELLED,
    STATUS_OVERDUE,
    STATUS_PAID,
    STATUS_PARTIAL,
    STATUS_PENDING,
    amount_if_overdue,
    compute_status,
    status_counts_from_rows,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def scalar_number(value):
    return float(value or 0)


def scalar_count(value):
    return int(value or 0)


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

    sales_rows_raw = db.query(
        SalesInvoiceHdr.invoice_no,
        SalesInvoiceHdr.grand_total,
        SalesInvoiceHdr.balance,
        SalesInvoiceHdr.due_date,
    ).all()

    sales_rows = [
        {
            "invoice_no": invoice_no,
            "grand_total": grand_total,
            "balance": balance,
            "due_date": due_date,
            "cancelled": False,
        }
        for invoice_no, grand_total, balance, due_date in sales_rows_raw
    ]

    sales_counts = status_counts_from_rows(sales_rows, today=today)

    sales_invoice_count = len(sales_rows)
    sales_pending_count = sales_counts[STATUS_PENDING]
    sales_partial_count = sales_counts[STATUS_PARTIAL]
    sales_paid_count = sales_counts[STATUS_PAID]
    sales_overdue_count = sales_counts[STATUS_OVERDUE]
    sales_cancelled_count = sales_counts[STATUS_CANCELLED]

    overdue_receivables_total = 0
    for row in sales_rows:
        overdue_receivables_total += amount_if_overdue(
            grand_total=row["grand_total"],
            balance=row["balance"],
            due_date=row["due_date"],
            cancelled=row["cancelled"],
            today=today,
        )

    # ============================
    # PURCHASE / AP STATUS COUNTS
    # ============================

    purchase_rows_raw = db.query(
        PurchaseInvoiceHdr.bill_no,
        PurchaseInvoiceHdr.grand_total,
        PurchaseInvoiceHdr.balance,
        PurchaseInvoiceHdr.due_date,
    ).all()

    purchase_rows = [
        {
            "bill_no": bill_no,
            "grand_total": grand_total,
            "balance": balance,
            "due_date": due_date,
            "cancelled": False,
        }
        for bill_no, grand_total, balance, due_date in purchase_rows_raw
    ]

    purchase_counts = status_counts_from_rows(purchase_rows, today=today)

    purchase_bill_count = len(purchase_rows)
    purchase_pending_count = purchase_counts[STATUS_PENDING]
    purchase_partial_count = purchase_counts[STATUS_PARTIAL]
    purchase_paid_count = purchase_counts[STATUS_PAID]
    purchase_overdue_count = purchase_counts[STATUS_OVERDUE]
    purchase_cancelled_count = purchase_counts[STATUS_CANCELLED]

    overdue_payables_total = 0
    for row in purchase_rows:
        overdue_payables_total += amount_if_overdue(
            grand_total=row["grand_total"],
            balance=row["balance"],
            due_date=row["due_date"],
            cancelled=row["cancelled"],
            today=today,
        )

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
    # AGING BUCKETS (SALES / AR)
    # ============================

    invoice_aging_rows = db.query(
        SalesInvoiceHdr.grand_total,
        SalesInvoiceHdr.balance,
        SalesInvoiceHdr.due_date,
    ).filter(
        SalesInvoiceHdr.balance > 0
    ).all()

    aging = {
        "not_due": 0,
        "b0_30": 0,
        "b31_60": 0,
        "b61_90": 0,
        "b90_plus": 0,
    }

    for grand_total, balance, due_date in invoice_aging_rows:
        status = compute_status(
            grand_total=grand_total,
            balance=balance,
            due_date=due_date,
            cancelled=False,
            today=today,
        )

        if status == STATUS_PAID or status == STATUS_CANCELLED:
            continue

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