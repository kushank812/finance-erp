# app/api/vendor.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_operator_or_admin
from app.core.database import get_db
from app.models.vendor import Vendor
from app.models.purchase_invoice import PurchaseInvoiceHdr
from app.models.user import User
from app.schemas.vendor import VendorCreate, VendorUpdate, VendorOut
from app.utils.audit import log_activity
from app.utils.audit_constants import AuditAction, AuditModule
from app.utils.numbering import get_next_number
from app.utils.text import normalize_upper

router = APIRouter(prefix="/vendors", tags=["Vendors"])


def vendor_snapshot(obj: Vendor) -> dict:
    return {
        "vendor_code": obj.vendor_code,
        "vendor_name": getattr(obj, "vendor_name", None),
        "vendor_address_line1": getattr(obj, "vendor_address_line1", None),
        "vendor_address_line2": getattr(obj, "vendor_address_line2", None),
        "vendor_address_line3": getattr(obj, "vendor_address_line3", None),
        "city": getattr(obj, "city", None),
        "state": getattr(obj, "state", None),
        "pincode": getattr(obj, "pincode", None),
        "mobile_no": getattr(obj, "mobile_no", None),
        "ph_no": getattr(obj, "ph_no", None),
        "email_id": getattr(obj, "email_id", None),
        "gst_no": getattr(obj, "gst_no", None),
    }


@router.get("/", response_model=list[VendorOut])
def list_vendors(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    return db.query(Vendor).order_by(Vendor.vendor_code).all()


@router.get("/{vendor_code}", response_model=VendorOut)
def get_vendor(
    vendor_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    obj = db.get(Vendor, vendor_code.strip().upper())
    if not obj:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return obj


@router.get("/{vendor_code}/statement")
def get_vendor_statement(
    vendor_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    vendor_code = vendor_code.strip().upper()

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
def create_vendor(
    payload: VendorCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    data = normalize_upper(payload.model_dump())

    try:
        vendor_code = get_next_number(db, "VENDOR")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    data["vendor_code"] = vendor_code

    obj = Vendor(**data)
    db.add(obj)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.CREATE,
        module=AuditModule.VENDOR,
        record_id=obj.vendor_code,
        record_name=obj.vendor_name,
        details=f"Vendor created: {obj.vendor_code}",
        new_values=vendor_snapshot(obj),
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not create vendor due to a conflicting change")

    db.refresh(obj)
    return obj


@router.put("/{vendor_code}", response_model=VendorOut)
def update_vendor(
    vendor_code: str,
    payload: VendorUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    obj = db.get(Vendor, vendor_code.strip().upper())
    if not obj:
        raise HTTPException(status_code=404, detail="Vendor not found")

    old_values = vendor_snapshot(obj)
    data = normalize_upper(payload.model_dump(exclude_unset=True))

    for k, v in data.items():
        setattr(obj, k, v)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.UPDATE,
        module=AuditModule.VENDOR,
        record_id=obj.vendor_code,
        record_name=obj.vendor_name,
        details=f"Vendor updated: {obj.vendor_code}",
        old_values=old_values,
        new_values=vendor_snapshot(obj),
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Could not update vendor due to a conflicting change")

    db.refresh(obj)
    return obj


@router.delete("/{vendor_code}")
def delete_vendor(
    vendor_code: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    obj = db.get(Vendor, vendor_code.strip().upper())
    if not obj:
        raise HTTPException(status_code=404, detail="Vendor not found")

    old_values = vendor_snapshot(obj)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.DELETE,
        module=AuditModule.VENDOR,
        record_id=obj.vendor_code,
        record_name=obj.vendor_name,
        details=f"Vendor deleted: {obj.vendor_code}",
        old_values=old_values,
        new_values=None,
    )

    db.delete(obj)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Vendor cannot be deleted because it is linked to existing records")

    return {"ok": True}