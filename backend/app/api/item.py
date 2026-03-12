# app/api/item.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.item import Item
from app.schemas.item import ItemCreate, ItemUpdate, ItemOut
from app.utils.text import normalize_upper

router = APIRouter(prefix="/items", tags=["Items"])


@router.get("/", response_model=list[ItemOut])
def list_items(db: Session = Depends(get_db)):
    return db.query(Item).order_by(Item.item_code).all()


@router.get("/{item_code}", response_model=ItemOut)
def get_item(item_code: str, db: Session = Depends(get_db)):
    obj = db.get(Item, item_code)
    if not obj:
        raise HTTPException(status_code=404, detail="Item not found")
    return obj


@router.post("/", response_model=ItemOut)
def create_item(payload: ItemCreate, db: Session = Depends(get_db)):
    data = normalize_upper(payload.model_dump())

    existing = db.get(Item, data["item_code"])
    if existing:
        raise HTTPException(status_code=400, detail="Item code already exists")

    obj = Item(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{item_code}", response_model=ItemOut)
def update_item(item_code: str, payload: ItemUpdate, db: Session = Depends(get_db)):
    obj = db.get(Item, item_code)
    if not obj:
        raise HTTPException(status_code=404, detail="Item not found")

    data = normalize_upper(payload.model_dump(exclude_unset=True))

    for k, v in data.items():
        setattr(obj, k, v)

    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{item_code}")
def delete_item(item_code: str, db: Session = Depends(get_db)):
    obj = db.get(Item, item_code)
    if not obj:
        raise HTTPException(status_code=404, detail="Item not found")

    db.delete(obj)
    db.commit()
    return {"ok": True}