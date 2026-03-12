# app/api/customer.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerOut
from app.utils.text import normalize_upper

router = APIRouter(prefix="/customers", tags=["Customers"])


@router.get("/", response_model=list[CustomerOut])
def list_customers(db: Session = Depends(get_db)):
    return db.query(Customer).order_by(Customer.customer_code).all()


@router.get("/{customer_code}", response_model=CustomerOut)
def get_customer(customer_code: str, db: Session = Depends(get_db)):
    obj = db.get(Customer, customer_code)
    if not obj:
      raise HTTPException(status_code=404, detail="Customer not found")
    return obj


@router.post("/", response_model=CustomerOut)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    data = normalize_upper(payload.model_dump())

    existing = db.get(Customer, data["customer_code"])
    if existing:
        raise HTTPException(status_code=400, detail="Customer code already exists")

    obj = Customer(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{customer_code}", response_model=CustomerOut)
def update_customer(customer_code: str, payload: CustomerUpdate, db: Session = Depends(get_db)):
    obj = db.get(Customer, customer_code)
    if not obj:
        raise HTTPException(status_code=404, detail="Customer not found")

    data = normalize_upper(payload.model_dump(exclude_unset=True))

    for k, v in data.items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{customer_code}")
def delete_customer(customer_code: str, db: Session = Depends(get_db)):
    obj = db.get(Customer, customer_code)
    if not obj:
        raise HTTPException(status_code=404, detail="Customer not found")

    db.delete(obj)
    db.commit()
    return {"ok": True}