from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.auth import require_admin
from app.core.database import get_db
from app.models.user import User
from app.schemas.user_admin import (
    UserCreateIn,
    UserOut,
    UserResetPasswordIn,
    UserUpdateIn,
)
from app.utils.security import hash_password

router = APIRouter(
    prefix="/users",
    tags=["Users"],
    dependencies=[Depends(require_admin)],
)


VALID_ROLES = {"ADMIN", "OPERATOR", "VIEWER"}


@router.get("/", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.user_id).all()


@router.post("/", response_model=UserOut)
def create_user(payload: UserCreateIn, db: Session = Depends(get_db)):
    user_id = payload.user_id.strip().upper()
    full_name = payload.full_name.strip().upper()
    role = payload.role.strip().upper()

    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    existing = db.get(User, user_id)
    if existing:
        raise HTTPException(status_code=400, detail="User ID already exists")

    obj = User(
        user_id=user_id,
        full_name=full_name,
        password_hash=hash_password(payload.password),
        is_active=True,
        role=role,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{user_id}", response_model=UserOut)
def update_user(user_id: str, payload: UserUpdateIn, db: Session = Depends(get_db)):
    obj = db.get(User, user_id.upper())
    if not obj:
        raise HTTPException(status_code=404, detail="User not found")

    role = payload.role.strip().upper()
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    obj.full_name = payload.full_name.strip().upper()
    obj.role = role
    obj.is_active = payload.is_active

    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{user_id}/reset-password")
def reset_user_password(user_id: str, payload: UserResetPasswordIn, db: Session = Depends(get_db)):
    obj = db.get(User, user_id.upper())
    if not obj:
        raise HTTPException(status_code=404, detail="User not found")

    obj.password_hash = hash_password(payload.new_password)
    db.commit()

    return {"ok": True, "message": "Password reset successfully"}