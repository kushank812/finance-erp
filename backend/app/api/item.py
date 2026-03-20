from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_operator_or_admin, require_viewer_or_above
from app.core.database import get_db
from app.models.item import Item
from app.models.user import User
from app.schemas.item import ItemCreate, ItemOut, ItemUpdate
from app.utils.audit import log_activity
from app.utils.audit_constants import AuditAction, AuditModule
from app.utils.numbering import get_next_number
from app.utils.text import normalize_upper

router = APIRouter(prefix="/items", tags=["Items"])


def item_snapshot(obj: Item) -> dict:
    return {
        "item_code": obj.item_code,
        "item_name": getattr(obj, "item_name", None),
        "units": getattr(obj, "units", None),
        "opening_balance": float(obj.opening_balance)
        if getattr(obj, "opening_balance", None) is not None
        else None,
        "cost_price": float(obj.cost_price)
        if getattr(obj, "cost_price", None) is not None
        else None,
        "selling_price": float(obj.selling_price)
        if getattr(obj, "selling_price", None) is not None
        else None,
    }


@router.get("/", response_model=list[ItemOut])
def list_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    return db.query(Item).order_by(Item.item_code).all()


@router.get("/{item_code}", response_model=ItemOut)
def get_item(
    item_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_viewer_or_above),
):
    obj = db.get(Item, item_code.strip().upper())
    if not obj:
        raise HTTPException(status_code=404, detail="Item not found")
    return obj


@router.post("/", response_model=ItemOut)
def create_item(
    payload: ItemCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    data = normalize_upper(payload.model_dump())

    if not data.get("item_name"):
        raise HTTPException(status_code=400, detail="Item name is required")

    try:
        item_code = get_next_number(db, "ITEM", "ITEM")
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    data["item_code"] = item_code

    obj = Item(**data)
    db.add(obj)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.CREATE,
        module=AuditModule.ITEM,
        record_id=obj.item_code,
        record_name=getattr(obj, "item_name", obj.item_code),
        details=f"Item created: {obj.item_code}",
        new_values=item_snapshot(obj),
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Could not create item due to a conflicting change",
        )

    db.refresh(obj)
    return obj


@router.put("/{item_code}", response_model=ItemOut)
def update_item(
    item_code: str,
    payload: ItemUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    obj = db.get(Item, item_code.strip().upper())
    if not obj:
        raise HTTPException(status_code=404, detail="Item not found")

    old_values = item_snapshot(obj)
    data = normalize_upper(payload.model_dump(exclude_unset=True))

    data.pop("item_code", None)

    for k, v in data.items():
        setattr(obj, k, v)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.UPDATE,
        module=AuditModule.ITEM,
        record_id=obj.item_code,
        record_name=getattr(obj, "item_name", obj.item_code),
        details=f"Item updated: {obj.item_code}",
        old_values=old_values,
        new_values=item_snapshot(obj),
    )

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Could not update item due to a conflicting change",
        )

    db.refresh(obj)
    return obj


@router.delete("/{item_code}")
def delete_item(
    item_code: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin),
):
    obj = db.get(Item, item_code.strip().upper())
    if not obj:
        raise HTTPException(status_code=404, detail="Item not found")

    old_values = item_snapshot(obj)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.DELETE,
        module=AuditModule.ITEM,
        record_id=obj.item_code,
        record_name=getattr(obj, "item_name", obj.item_code),
        details=f"Item deleted: {obj.item_code}",
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
            detail="Item cannot be deleted because it is linked to existing records",
        )

    return {"ok": True}