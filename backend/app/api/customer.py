from datetime import date, datetime
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_operator_or_admin, require_viewer_or_above
from app.core.database import get_db
from app.models.customer import Customer
from app.models.journal_voucher import JournalVoucherHdr
from app.models.sales_invoice import SalesInvoiceHdr, SalesReceipt
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerOut, CustomerUpdate
from app.utils.audit import log_activity
from app.utils.audit_constants import AuditAction, AuditModule
from app.utils.numbering import get_next_number
from app.utils.text import normalize_upper

router = APIRouter(prefix="/customers", tags=["Customers"])


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


def customer_snapshot(obj: Customer) -> dict:
    return {
        "customer_code": obj.customer_code,
        "customer_name": obj.customer_name,
        "customer_address_line1": getattr(obj, "customer_address_line1", None),
        "customer_address_line2": getattr(obj, "customer_address_line2", None),
        "customer_address_line3": getattr(obj, "customer_address_line3", None),
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


def _validate_customer_data(data: dict, *, partial: bool = False) -> dict:
    cleaned = dict(data)

    for key in [
        "customer_name",
        "customer_address_line1",
        "customer_address_line2",
        "customer_address_line3",
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
        if not cleaned.get("customer_name"):
            raise HTTPException(status_code=400, detail="Customer name is required")
        if not cleaned.get("city"):
            raise HTTPException(status_code=400, detail="City is required")
        if not cleaned.get("state"):
            raise HTTPException(status_code=400, detail="State is required")

    if "customer_name" in cleaned and cleaned["customer_name"] == "":
        raise HTTPException(status_code=400, detail="Customer name is required")

    if "city" in cleaned and cleaned["city"] == "":
        raise HTTPException(status_code=400, detail="City is required")

    if "state" in cleaned:
        if cleaned["state"] == "":
            raise HTTPException(status_code=400, detail="State is required")
        if cleaned["state"] not in INDIAN_STATES:
            raise HTTPException(status_code=400, detail="Invalid state selected")

    if "pincode" in cleaned and cleaned["pincode"]:
        if len(cleaned["pincode"]) != 6:
            raise HTTPException(status_code=400, detail="Pin Code must be exactly 6 digits")

    if "mobile_no" in cleaned and cleaned["mobile_no"]:
        if len(cleaned["mobile_no"]) != 10:
            raise HTTPException(status_code=400, detail="Mobile No must be exactly 10 digits")

    if "ph_no" in cleaned and cleaned["ph_no"]:
        if len(cleaned["ph_no"]) < 6:
            raise HTTPException(status_code=400, detail="Phone No must contain at least 6 digits")

    if "email_id" in cleaned and cleaned["email_id"]:
        if not _is_valid_email(cleaned["email_id"]):
            raise HTTPException(status_code=400, detail="Enter a valid Email ID")

    if "gst_no" in cleaned and cleaned["gst_no"]:
        if len(cleaned["gst_no"]) != 15:
            raise HTTPException(status_code=400, detail="GST No must be exactly 15 characters")
        if not _is_valid_gst(cleaned["gst_no"]):
            raise HTTPException(status_code=400, detail="Enter a valid GST No")

    return cleaned


def safe_date_string(value) -> str | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.date().isoformat()

    if isinstance(value, date):
        return value.isoformat()

    s = str(value).strip()
    if not s:
        return None

    if "T" in s:
        s = s.split("T")[0]

    return s[:10]


@router.get("/", response_model=list[CustomerOut])
def list_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    return db.query(Customer).order_by(Customer.customer_code).all()


@router.get("/{customer_code}", response_model=CustomerOut)
def get_customer(
    customer_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    obj = db.get(Customer, customer_code.strip().upper())
    if not obj:
        raise HTTPException(status_code=404, detail="Customer not found")
    return obj


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

    receipts = db.scalars(
        select(SalesReceipt)
        .join(SalesInvoiceHdr, SalesInvoiceHdr.invoice_no == SalesReceipt.invoice_no)
        .where(func.upper(SalesInvoiceHdr.customer_code) == customer_code)
        .order_by(SalesReceipt.receipt_date, SalesReceipt.receipt_no)
    ).all()

    jvs = db.scalars(
        select(JournalVoucherHdr)
        .where(
            JournalVoucherHdr.reference_type == "SALES_INVOICE",
            func.upper(JournalVoucherHdr.party_code) == customer_code,
        )
        .order_by(JournalVoucherHdr.voucher_date, JournalVoucherHdr.voucher_no)
    ).all()

    rows = []

    for inv in invoices:
        rows.append(
            {
                "date": safe_date_string(inv.invoice_date),
                "doc_no": inv.invoice_no,
                "type": "Invoice",
                "debit": float(inv.grand_total or 0),
                "credit": 0.0,
            }
        )

    for rcpt in receipts:
        rows.append(
            {
                "date": safe_date_string(rcpt.receipt_date),
                "doc_no": rcpt.receipt_no,
                "type": "Receipt",
                "debit": 0.0,
                "credit": float(rcpt.amount or 0),
            }
        )

    for jv in jvs:
        rows.append(
            {
                "date": safe_date_string(jv.voucher_date),
                "doc_no": jv.voucher_no,
                "type": "Journal Voucher",
                "debit": 0.0,
                "credit": float(jv.amount or 0),
            }
        )

    rows.sort(
        key=lambda x: (
            x.get("date") or "",
            x.get("doc_no") or "",
            x.get("type") or "",
        )
    )

    balance = 0.0
    for r in rows:
        balance += float(r.get("debit") or 0)
        balance -= float(r.get("credit") or 0)
        r["balance"] = balance

    return rows


@router.post("/", response_model=CustomerOut)
def create_customer(
    payload: CustomerCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    raw_data = normalize_upper(payload.model_dump())
    data = _validate_customer_data(raw_data, partial=False)

    try:
        customer_code = get_next_number(db, "CUSTOMER", "CUST")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    data["customer_code"] = customer_code

    obj = Customer(**data)
    db.add(obj)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.CREATE,
        module=AuditModule.CUSTOMER,
        record_id=obj.customer_code,
        record_name=obj.customer_name,
        details=f"Customer created: {obj.customer_code}",
        new_values=customer_snapshot(obj),
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Could not create customer due to a conflicting change",
        )

    db.refresh(obj)
    return obj


@router.put("/{customer_code}", response_model=CustomerOut)
def update_customer(
    customer_code: str,
    payload: CustomerUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    obj = db.get(Customer, customer_code.strip().upper())
    if not obj:
        raise HTTPException(status_code=404, detail="Customer not found")

    old_values = customer_snapshot(obj)
    raw_data = normalize_upper(payload.model_dump(exclude_unset=True))
    raw_data.pop("customer_code", None)

    data = _validate_customer_data(raw_data, partial=True)

    for k, v in data.items():
        setattr(obj, k, v)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.UPDATE,
        module=AuditModule.CUSTOMER,
        record_id=obj.customer_code,
        record_name=obj.customer_name,
        details=f"Customer updated: {obj.customer_code}",
        old_values=old_values,
        new_values=customer_snapshot(obj),
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Could not update customer due to a conflicting change",
        )

    db.refresh(obj)
    return obj


@router.delete("/{customer_code}")
def delete_customer(
    customer_code: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    obj = db.get(Customer, customer_code.strip().upper())
    if not obj:
        raise HTTPException(status_code=404, detail="Customer not found")

    old_values = customer_snapshot(obj)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.DELETE,
        module=AuditModule.CUSTOMER,
        record_id=obj.customer_code,
        record_name=obj.customer_name,
        details=f"Customer deleted: {obj.customer_code}",
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
            detail="Customer cannot be deleted because it is linked to existing records",
        )

    return {"ok": True}