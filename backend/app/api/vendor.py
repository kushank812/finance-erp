from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_operator_or_admin, require_viewer_or_above
from app.core.database import get_db
from app.models.purchase_invoice import PurchaseInvoiceHdr
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.vendor import VendorCreate, VendorOut, VendorUpdate
from app.utils.audit import log_activity
from app.utils.audit_constants import AuditAction, AuditModule
from app.utils.numbering import get_next_number
from app.utils.text import normalize_upper

router = APIRouter(prefix="/vendors", tags=["Vendors"])


INDIAN_STATES = {
    "ANDHRA PRADESH",
    "ARUNACHAL PRADESH",
    "ASSAM",
    "BIHAR",
    "CHHATTISGARH",
    "GOA",
    "GUJARAT",
    "HARYANA",
    "HIMACHAL PRADESH",
    "JHARKHAND",
    "KARNATAKA",
    "KERALA",
    "MADHYA PRADESH",
    "MAHARASHTRA",
    "MANIPUR",
    "MEGHALAYA",
    "MIZORAM",
    "NAGALAND",
    "ODISHA",
    "PUNJAB",
    "RAJASTHAN",
    "SIKKIM",
    "TAMIL NADU",
    "TELANGANA",
    "TRIPURA",
    "UTTAR PRADESH",
    "UTTARAKHAND",
    "WEST BENGAL",
    "ANDAMAN AND NICOBAR ISLANDS",
    "CHANDIGARH",
    "DADRA AND NAGAR HAVELI AND DAMAN AND DIU",
    "DELHI",
    "JAMMU AND KASHMIR",
    "LADAKH",
    "LAKSHADWEEP",
    "PUDUCHERRY",
}


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


def _clean_str(value) -> str:
    return str(value or "").strip()


def _digits_only(value, max_len: int | None = None) -> str:
    cleaned = "".join(ch for ch in _clean_str(value) if ch.isdigit())
    if max_len is not None:
        cleaned = cleaned[:max_len]
    return cleaned


def _email_clean(value) -> str:
    return _clean_str(value).lower().replace(" ", "")


def _gst_clean(value) -> str:
    cleaned = "".join(ch for ch in _clean_str(value).upper() if ch.isalnum())
    return cleaned[:15]


def _is_valid_email(value: str) -> bool:
    if not value:
        return True
    if "@" not in value:
        return False
    local, _, domain = value.partition("@")
    if not local or not domain or "." not in domain:
        return False
    if value.startswith("@") or value.endswith("@"):
        return False
    return True


def _is_valid_gst(value: str) -> bool:
    if not value:
        return True
    if len(value) != 15:
        return False

    if not value[:2].isdigit():
        return False
    if not value[2:7].isalpha():
        return False
    if not value[7:11].isdigit():
        return False
    if not value[11].isalpha():
        return False
    if not value[12].isalnum():
        return False
    if value[13] != "Z":
        return False
    if not value[14].isalnum():
        return False

    return True


def _validate_vendor_data(data: dict, *, partial: bool = False) -> dict:
    cleaned = dict(data)

    for key in [
        "vendor_name",
        "vendor_address_line1",
        "vendor_address_line2",
        "vendor_address_line3",
        "city",
        "state",
    ]:
        if key in cleaned and cleaned[key] is not None:
            cleaned[key] = _clean_str(cleaned[key]).upper()

    if "email_id" in cleaned and cleaned["email_id"] is not None:
        cleaned["email_id"] = _email_clean(cleaned["email_id"])

    if "pincode" in cleaned and cleaned["pincode"] is not None:
        cleaned["pincode"] = _digits_only(cleaned["pincode"], 6)

    if "mobile_no" in cleaned and cleaned["mobile_no"] is not None:
        cleaned["mobile_no"] = _digits_only(cleaned["mobile_no"], 10)

    if "ph_no" in cleaned and cleaned["ph_no"] is not None:
        cleaned["ph_no"] = _digits_only(cleaned["ph_no"], 15)

    if "gst_no" in cleaned and cleaned["gst_no"] is not None:
        cleaned["gst_no"] = _gst_clean(cleaned["gst_no"])

    if not partial:
        if not cleaned.get("vendor_name"):
            raise HTTPException(status_code=400, detail="Vendor name is required")
        if not cleaned.get("city"):
            raise HTTPException(status_code=400, detail="City is required")
        if not cleaned.get("state"):
            raise HTTPException(status_code=400, detail="State is required")

    if "vendor_name" in cleaned and cleaned["vendor_name"] == "":
        raise HTTPException(status_code=400, detail="Vendor name is required")

    if "city" in cleaned and cleaned["city"] == "":
        raise HTTPException(status_code=400, detail="City is required")

    if "state" in cleaned:
        if cleaned["state"] == "":
            raise HTTPException(status_code=400, detail="State is required")
        if cleaned["state"] not in INDIAN_STATES:
            raise HTTPException(status_code=400, detail="Invalid state selected")

    if "pincode" in cleaned and cleaned["pincode"]:
        if len(cleaned["pincode"]) != 6:
            raise HTTPException(
                status_code=400,
                detail="Pin Code must be exactly 6 digits",
            )

    if "mobile_no" in cleaned and cleaned["mobile_no"]:
        if len(cleaned["mobile_no"]) != 10:
            raise HTTPException(
                status_code=400,
                detail="Mobile No must be exactly 10 digits",
            )

    if "ph_no" in cleaned and cleaned["ph_no"]:
        if len(cleaned["ph_no"]) < 6:
            raise HTTPException(
                status_code=400,
                detail="Phone No must contain at least 6 digits",
            )

    if "email_id" in cleaned and cleaned["email_id"]:
        if not _is_valid_email(cleaned["email_id"]):
            raise HTTPException(status_code=400, detail="Enter a valid Email ID")

    if "gst_no" in cleaned and cleaned["gst_no"]:
        if len(cleaned["gst_no"]) != 15:
            raise HTTPException(
                status_code=400,
                detail="GST No must be exactly 15 characters",
            )
        if not _is_valid_gst(cleaned["gst_no"]):
            raise HTTPException(status_code=400, detail="Enter a valid GST No")

    return cleaned


@router.get("/", response_model=list[VendorOut])
def list_vendors(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    return db.query(Vendor).order_by(Vendor.vendor_code).all()


@router.get("/{vendor_code}", response_model=VendorOut)
def get_vendor(
    vendor_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    obj = db.get(Vendor, vendor_code.strip().upper())
    if not obj:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return obj


@router.get("/{vendor_code}/statement")
def get_vendor_statement(
    vendor_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
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
    raw_data = normalize_upper(payload.model_dump())
    data = _validate_vendor_data(raw_data, partial=False)

    try:
        vendor_code = get_next_number(db, "VENDOR", "VEND")
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
        raise HTTPException(
            status_code=409,
            detail="Could not create vendor due to a conflicting change",
        )

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
    raw_data = normalize_upper(payload.model_dump(exclude_unset=True))
    raw_data.pop("vendor_code", None)

    data = _validate_vendor_data(raw_data, partial=True)

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
        raise HTTPException(
            status_code=409,
            detail="Could not update vendor due to a conflicting change",
        )

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
        raise HTTPException(
            status_code=409,
            detail="Vendor cannot be deleted because it is linked to existing records",
        )

    return {"ok": True}