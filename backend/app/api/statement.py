from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.api.auth import require_viewer_or_above
from app.core.database import get_db
from app.models.customer import Customer
from app.models.sales_invoice import SalesInvoiceHdr
from app.models.user import User

router = APIRouter(prefix="/customers", tags=["Statements"])


@router.get("/{customer_code}/statement")
def customer_statement(
    customer_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    customer_code = customer_code.strip().upper()

    customer = db.get(Customer, customer_code)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    invoices = db.scalars(
        select(SalesInvoiceHdr)
        .where(func.upper(SalesInvoiceHdr.customer_code) == customer_code)
        .order_by(SalesInvoiceHdr.invoice_date, SalesInvoiceHdr.invoice_no)
    ).all()

    rows = []

    for inv in invoices:
        rows.append(
            {
                "date": inv.invoice_date,
                "doc_no": inv.invoice_no,
                "type": "Invoice",
                "debit": float(inv.grand_total or 0),
                "credit": 0,
            }
        )

        if inv.amount_received and float(inv.amount_received) > 0:
            rows.append(
                {
                    "date": inv.invoice_date,
                    "doc_no": inv.invoice_no,
                    "type": "Receipt",
                    "debit": 0,
                    "credit": float(inv.amount_received or 0),
                }
            )

    rows.sort(key=lambda x: (x["date"], x["doc_no"], x["type"]))

    balance = 0.0
    for r in rows:
        balance += float(r["debit"] or 0)
        balance -= float(r["credit"] or 0)
        r["balance"] = balance

    return rows