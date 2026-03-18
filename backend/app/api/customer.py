# app/api/customer.py
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_operator_or_admin
from app.core.database import get_db
from app.models.customer import Customer
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerOut
from app.utils.audit import log_activity
from app.utils.audit_constants import AuditAction, AuditModule
from app.utils.text import normalize_upper

router = APIRouter(prefix="/customers", tags=["Customers"])


def customer_snapshot(obj: Customer) -> dict:
    return {
        "customer_code": obj.customer_code,
        "customer_name": obj.customer_name,
        "address": getattr(obj, "address", None),
        "city": getattr(obj, "city", None),
        "state": getattr(obj, "state", None),
        "pincode": getattr(obj, "pincode", None),
        "mobile_no": getattr(obj, "mobile_no", None),
        "email": getattr(obj, "email", None),
        "gst_no": getattr(obj, "gst_no", None),
    }


@router.get("/", response_model=list[CustomerOut])
def list_customers(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    return db.query(Customer).order_by(Customer.customer_code).all()


@router.get("/{customer_code}", response_model=CustomerOut)
def get_customer(
    customer_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    obj = db.get(Customer, customer_code.strip().upper())
    if not obj:
        raise HTTPException(status_code=404, detail="Customer not found")
    return obj


@router.post("/", response_model=CustomerOut)
def create_customer(
    payload: CustomerCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    data = normalize_upper(payload.model_dump())
    customer_code = str(data["customer_code"]).strip().upper()

    existing = db.get(Customer, customer_code)
    if existing:
        raise HTTPException(status_code=409, detail="Customer code already exists")

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
        new_values=data,
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Customer code already exists")

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
    data = normalize_upper(payload.model_dump(exclude_unset=True))

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