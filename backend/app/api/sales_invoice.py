from decimal import Decimal
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.sales_invoice import SalesInvoiceHdr, SalesInvoiceDtl, SalesReceipt
from app.schemas.sales_invoice import SalesInvoiceCreate, SalesInvoiceOut
from app.utils.text import normalize_upper

router = APIRouter(prefix="/sales-invoices", tags=["Sales Invoices"])


class ReceivePaymentIn(BaseModel):
    amount: float
    remark: str | None = None


def compute_status(balance: Decimal | float, grand_total: Decimal | float, due_date: date | None) -> str:
    bal = Decimal(str(balance or 0))
    total = Decimal(str(grand_total or 0))

    if bal <= 0:
        return "Paid"
    if bal < total:
        return "Partial"
    if due_date and date.today() > due_date:
        return "Overdue"
    return "Pending"


def next_receipt_no(db: Session) -> str:
    rows = db.query(SalesReceipt).all()
    max_no = 0

    for r in rows:
        text = str(r.receipt_no or "")
        digits = "".join(ch for ch in text if ch.isdigit())
        if digits:
            max_no = max(max_no, int(digits))

    return f"RCPT{max_no + 1:04d}"


@router.get("/", response_model=list[SalesInvoiceOut])
def list_sales_invoices(db: Session = Depends(get_db)):
    rows = db.query(SalesInvoiceHdr).order_by(
        SalesInvoiceHdr.invoice_date.desc(),
        SalesInvoiceHdr.invoice_no.desc()
    ).all()

    changed = False
    for r in rows:
        new_status = compute_status(r.balance, r.grand_total, r.due_date)
        if r.status != new_status:
            r.status = new_status
            changed = True

    if changed:
        db.commit()

    return rows


@router.get("/{invoice_no}", response_model=SalesInvoiceOut)
def get_sales_invoice(invoice_no: str, db: Session = Depends(get_db)):
    obj = db.get(SalesInvoiceHdr, invoice_no)
    if not obj:
        raise HTTPException(status_code=404, detail="Sales invoice not found")

    new_status = compute_status(obj.balance, obj.grand_total, obj.due_date)
    if obj.status != new_status:
        obj.status = new_status
        db.commit()
        db.refresh(obj)

    return obj


@router.post("/", response_model=SalesInvoiceOut)
def create_sales_invoice(payload: SalesInvoiceCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    data = normalize_upper(data)

    invoice_no = data["invoice_no"]
    customer_code = data["customer_code"]
    invoice_date = data["invoice_date"]
    due_date = data.get("due_date")
    tax_percent = Decimal(str(data.get("tax_percent") or 0))
    remark = data.get("remark")
    lines = data.get("lines", [])

    existing = db.get(SalesInvoiceHdr, invoice_no)
    if existing:
        raise HTTPException(status_code=400, detail="Invoice number already exists")

    if not lines:
        raise HTTPException(status_code=400, detail="At least one line is required")

    subtotal = Decimal("0.00")
    dtl_rows: list[SalesInvoiceDtl] = []

    for ln in lines:
        ln = normalize_upper(ln)

        qty = Decimal(str(ln["qty"]))
        rate = Decimal(str(ln["rate"]))
        line_total = qty * rate
        subtotal += line_total

        dtl_rows.append(
            SalesInvoiceDtl(
                invoice_no=invoice_no,
                item_code=ln["item_code"],
                qty=qty,
                rate=rate,
                line_total=line_total,
            )
        )

    tax_amount = (subtotal * tax_percent) / Decimal("100")
    grand_total = subtotal + tax_amount
    amount_received = Decimal("0.00")
    balance = grand_total
    status = compute_status(balance, grand_total, due_date)

    hdr = SalesInvoiceHdr(
        invoice_no=invoice_no,
        invoice_date=invoice_date,
        due_date=due_date,
        customer_code=customer_code,
        subtotal=subtotal,
        tax_percent=tax_percent,
        tax_amount=tax_amount,
        grand_total=grand_total,
        amount_received=amount_received,
        balance=balance,
        status=status,
        remark=remark,
        lines=dtl_rows,
    )

    db.add(hdr)
    db.commit()
    db.refresh(hdr)
    return hdr


@router.post("/{invoice_no}/receive")
def receive_payment(invoice_no: str, payload: ReceivePaymentIn, db: Session = Depends(get_db)):
    obj = db.get(SalesInvoiceHdr, invoice_no)
    if not obj:
        raise HTTPException(status_code=404, detail="Sales invoice not found")

    amount = Decimal(str(payload.amount or 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    if amount > Decimal(str(obj.balance or 0)):
        raise HTTPException(status_code=400, detail="Received amount cannot exceed balance")

    receipt_no = next_receipt_no(db)

    receipt = SalesReceipt(
        receipt_no=receipt_no,
        invoice_no=obj.invoice_no,
        receipt_date=date.today(),
        amount=amount,
        remark=str(payload.remark).strip().upper() if payload.remark and str(payload.remark).strip() else None,
    )
    db.add(receipt)

    obj.amount_received = Decimal(str(obj.amount_received or 0)) + amount
    obj.balance = Decimal(str(obj.grand_total or 0)) - Decimal(str(obj.amount_received or 0))
    obj.status = compute_status(obj.balance, obj.grand_total, obj.due_date)

    db.commit()
    db.refresh(receipt)

    return {
        "ok": True,
        "receipt_no": receipt.receipt_no,
        "invoice_no": receipt.invoice_no,
        "receipt_date": str(receipt.receipt_date),
        "amount": float(receipt.amount),
        "remark": receipt.remark,
    }