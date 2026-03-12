# app/api/vendor.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.vendor import Vendor
from app.models.purchase_invoice import PurchaseInvoiceHdr
from app.schemas.vendor import VendorCreate, VendorUpdate, VendorOut
from app.utils.text import normalize_upper

router = APIRouter(prefix="/vendors", tags=["Vendors"])


@router.get("/", response_model=list[VendorOut])
def list_vendors(db: Session = Depends(get_db)):
    return db.query(Vendor).order_by(Vendor.vendor_code).all()


@router.get("/{vendor_code}", response_model=VendorOut)
def get_vendor(vendor_code: str, db: Session = Depends(get_db)):
    obj = db.get(Vendor, vendor_code)
    if not obj:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return obj


@router.get("/{vendor_code}/statement")
def get_vendor_statement(vendor_code: str, db: Session = Depends(get_db)):
    vendor = db.get(Vendor, vendor_code)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    bills = (
        db.query(PurchaseInvoiceHdr)
        .filter(PurchaseInvoiceHdr.vendor_code == vendor_code)
        .order_by(PurchaseInvoiceHdr.bill_date.asc(), PurchaseInvoiceHdr.bill_no.asc())
        .all()
    )

    rows = []
    running_balance = 0.0

    for b in bills:
        bill_total = float(b.grand_total or 0)
        amount_paid = float(b.amount_paid or 0)

        running_balance += bill_total
        rows.append(
            {
                "date": b.bill_date,
                "doc_no": b.bill_no,
                "type": "Purchase Bill",
                "debit": 0,
                "credit": bill_total,
                "balance": running_balance,
            }
        )

        if amount_paid > 0:
            running_balance -= amount_paid
            rows.append(
                {
                    "date": b.bill_date,
                    "doc_no": b.bill_no,
                    "type": "Vendor Payment",
                    "debit": amount_paid,
                    "credit": 0,
                    "balance": running_balance,
                }
            )

    return rows


@router.post("/", response_model=VendorOut)
def create_vendor(payload: VendorCreate, db: Session = Depends(get_db)):
    data = normalize_upper(payload.model_dump())

    existing = db.get(Vendor, data["vendor_code"])
    if existing:
        raise HTTPException(status_code=400, detail="Vendor code already exists")

    obj = Vendor(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{vendor_code}", response_model=VendorOut)
def update_vendor(vendor_code: str, payload: VendorUpdate, db: Session = Depends(get_db)):
    obj = db.get(Vendor, vendor_code)
    if not obj:
        raise HTTPException(status_code=404, detail="Vendor not found")

    data = normalize_upper(payload.model_dump(exclude_unset=True))

    for k, v in data.items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{vendor_code}")
def delete_vendor(vendor_code: str, db: Session = Depends(get_db)):
    obj = db.get(Vendor, vendor_code)
    if not obj:
        raise HTTPException(status_code=404, detail="Vendor not found")

    db.delete(obj)
    db.commit()
    return {"ok": True}