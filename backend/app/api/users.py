from fastapi import APIRouter, Depends, HTTPException, Request
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
from app.utils.audit import log_activity
from app.utils.audit_constants import AuditAction, AuditModule

router = APIRouter(
    prefix="/users",
    tags=["Users"],
)


VALID_ROLES = {"ADMIN", "OPERATOR", "VIEWER"}


@router.get("/", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return db.query(User).order_by(User.user_id).all()


@router.post("/", response_model=UserOut)
def create_user(
    payload: UserCreateIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
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

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.CREATE,
        module=AuditModule.USER,
        record_id=obj.user_id,
        record_name=obj.full_name,
        details=f"User created: {obj.user_id}",
        new_values={
            "user_id": obj.user_id,
            "full_name": obj.full_name,
            "role": obj.role,
            "is_active": obj.is_active,
        },
    )

    db.commit()
    db.refresh(obj)
    return obj


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: str,
    payload: UserUpdateIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    obj = db.get(User, user_id.upper())
    if not obj:
        raise HTTPException(status_code=404, detail="User not found")

    role = payload.role.strip().upper()
    if role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    old_values = {
        "full_name": obj.full_name,
        "role": obj.role,
        "is_active": obj.is_active,
    }

    obj.full_name = payload.full_name.strip().upper()
    obj.role = role
    obj.is_active = payload.is_active

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.UPDATE,
        module=AuditModule.USER,
        record_id=obj.user_id,
        record_name=obj.full_name,
        details=f"User updated: {obj.user_id}",
        old_values=old_values,
        new_values={
            "full_name": obj.full_name,
            "role": obj.role,
            "is_active": obj.is_active,
        },
    )

    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{user_id}/reset-password")
def reset_user_password(
    user_id: str,
    payload: UserResetPasswordIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    obj = db.get(User, user_id.upper())
    if not obj:
        raise HTTPException(status_code=404, detail="User not found")

    obj.password_hash = hash_password(payload.new_password)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.PASSWORD_RESET,
        module=AuditModule.USER,
        record_id=obj.user_id,
        record_name=obj.full_name,
        details=f"Password reset for user: {obj.user_id}",
    )

    db.commit()

    return {"ok": True, "message": "Password reset successfully"}