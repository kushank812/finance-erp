from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.core.database import get_db

from app.models.sales_invoice import SalesInvoiceHdr

router = APIRouter(prefix="/customers", tags=["Statements"])


@router.get("/{customer_code}/statement")
def customer_statement(customer_code: str, db: Session = Depends(get_db)):
    invoices = db.scalars(
        select(SalesInvoiceHdr)
        .where(func.lower(SalesInvoiceHdr.customer_code) == customer_code.lower())
        .order_by(SalesInvoiceHdr.invoice_date)
    ).all()

    rows = []

    for inv in invoices:
        rows.append({
            "date": inv.invoice_date,
            "doc_no": inv.invoice_no,
            "type": "Invoice",
            "debit": float(inv.grand_total),
            "credit": 0,
        })

        if inv.amount_received and float(inv.amount_received) > 0:
            rows.append({
                "date": inv.invoice_date,
                "doc_no": inv.invoice_no,
                "type": "Receipt",
                "debit": 0,
                "credit": float(inv.amount_received),
            })

    rows.sort(key=lambda x: x["date"])

    balance = 0
    for r in rows:
        balance += r["debit"]
        balance -= r["credit"]
        r["balance"] = balance

    return rows