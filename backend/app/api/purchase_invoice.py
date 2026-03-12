# app/api/purchase_invoice.py
from decimal import Decimal
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.purchase_invoice import PurchaseInvoiceHdr, PurchaseInvoiceDtl
from app.schemas.purchase_invoice import PurchaseInvoiceCreate, PurchaseInvoiceOut
from app.utils.text import normalize_upper

router = APIRouter(prefix="/purchase-invoices", tags=["Purchase Invoices"])


class PayBillIn(BaseModel):
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


@router.get("/", response_model=list[PurchaseInvoiceOut])
def list_purchase_invoices(db: Session = Depends(get_db)):
    rows = db.query(PurchaseInvoiceHdr).order_by(PurchaseInvoiceHdr.bill_date.desc(), PurchaseInvoiceHdr.bill_no.desc()).all()

    changed = False
    for r in rows:
        new_status = compute_status(r.balance, r.grand_total, r.due_date)
        if r.status != new_status:
            r.status = new_status
            changed = True
    if changed:
        db.commit()

    return rows


@router.get("/{bill_no}", response_model=PurchaseInvoiceOut)
def get_purchase_invoice(bill_no: str, db: Session = Depends(get_db)):
    obj = db.get(PurchaseInvoiceHdr, bill_no)
    if not obj:
        raise HTTPException(status_code=404, detail="Purchase invoice not found")

    new_status = compute_status(obj.balance, obj.grand_total, obj.due_date)
    if obj.status != new_status:
        obj.status = new_status
        db.commit()
        db.refresh(obj)

    return obj


@router.post("/", response_model=PurchaseInvoiceOut)
def create_purchase_invoice(payload: PurchaseInvoiceCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    data = normalize_upper(data)

    bill_no = data["bill_no"]
    vendor_code = data["vendor_code"]
    bill_date = data["bill_date"]
    due_date = data.get("due_date")
    tax_percent = Decimal(str(data.get("tax_percent") or 0))
    remark = data.get("remark")
    lines = data.get("lines", [])

    existing = db.get(PurchaseInvoiceHdr, bill_no)
    if existing:
        raise HTTPException(status_code=400, detail="Bill number already exists")

    if not lines:
        raise HTTPException(status_code=400, detail="At least one line is required")

    subtotal = Decimal("0.00")
    dtl_rows: list[PurchaseInvoiceDtl] = []

    for ln in lines:
        ln = normalize_upper(ln)

        qty = Decimal(str(ln["qty"]))
        rate = Decimal(str(ln["rate"]))
        line_total = qty * rate
        subtotal += line_total

        dtl_rows.append(
            PurchaseInvoiceDtl(
                bill_no=bill_no,
                item_code=ln["item_code"],
                qty=qty,
                rate=rate,
                line_total=line_total,
            )
        )

    tax_amount = (subtotal * tax_percent) / Decimal("100")
    grand_total = subtotal + tax_amount
    amount_paid = Decimal("0.00")
    balance = grand_total
    status = compute_status(balance, grand_total, due_date)

    hdr = PurchaseInvoiceHdr(
        bill_no=bill_no,
        bill_date=bill_date,
        due_date=due_date,
        vendor_code=vendor_code,
        subtotal=subtotal,
        tax_percent=tax_percent,
        tax_amount=tax_amount,
        grand_total=grand_total,
        amount_paid=amount_paid,
        balance=balance,
        status=status,
        remark=remark,
        lines=dtl_rows,
    )

    db.add(hdr)
    db.commit()
    db.refresh(hdr)
    return hdr


@router.post("/{bill_no}/pay", response_model=PurchaseInvoiceOut)
def pay_bill(bill_no: str, payload: PayBillIn, db: Session = Depends(get_db)):
    obj = db.get(PurchaseInvoiceHdr, bill_no)
    if not obj:
        raise HTTPException(status_code=404, detail="Purchase invoice not found")

    amount = Decimal(str(payload.amount or 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")

    if amount > Decimal(str(obj.balance or 0)):
        raise HTTPException(status_code=400, detail="Paid amount cannot exceed balance")

    obj.amount_paid = Decimal(str(obj.amount_paid or 0)) + amount
    obj.balance = Decimal(str(obj.grand_total or 0)) - Decimal(str(obj.amount_paid or 0))
    obj.status = compute_status(obj.balance, obj.grand_total, obj.due_date)

    if payload.remark is not None and str(payload.remark).strip():
        obj.remark = str(payload.remark).strip().upper()

    db.commit()
    db.refresh(obj)
    return obj