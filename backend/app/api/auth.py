from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, UserSession
from app.schemas.auth import LoginIn, LoginOut, UserMeOut, ChangePasswordIn
from app.utils.security import (
    verify_password,
    new_session_token,
    hash_session_token,
    hash_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])

SESSION_COOKIE_NAME = "finance_session"
SESSION_HOURS = 12
REMEMBER_DAYS = 30


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def delete_expired_sessions(db: Session) -> None:
    now = utc_now()
    db.query(UserSession).filter(UserSession.expires_at < now).delete()
    db.commit()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    delete_expired_sessions(db)

    raw_token = request.cookies.get(SESSION_COOKIE_NAME)

    if not raw_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    token_hash = hash_session_token(raw_token)

    session = (
        db.query(UserSession)
        .filter(UserSession.session_token_hash == token_hash)
        .first()
    )

    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    if session.expires_at < utc_now():
        db.delete(session)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")

    user = db.get(User, session.user_id)

    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    session.last_seen_at = utc_now()
    db.commit()

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


def require_operator_or_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in {"ADMIN", "OPERATOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operator access required",
        )
    return current_user


@router.post("/login", response_model=LoginOut)
def login(payload: LoginIn, response: Response, db: Session = Depends(get_db)):
    delete_expired_sessions(db)

    user = db.get(User, payload.user_id.strip().upper())

    invalid_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials",
    )

    if not user or not user.is_active:
        raise invalid_error

    if not verify_password(payload.password, user.password_hash):
        raise invalid_error

    raw_token = new_session_token()
    token_hash = hash_session_token(raw_token)

    now = utc_now()

    expires_at = now + (
        timedelta(days=REMEMBER_DAYS)
        if payload.remember_session
        else timedelta(hours=SESSION_HOURS)
    )

    session = UserSession(
        user_id=user.user_id,
        session_token_hash=token_hash,
        expires_at=expires_at,
    )

    db.add(session)
    db.commit()

    # IMPORTANT: production cookie settings
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=int((expires_at - now).total_seconds()),
        expires=int((expires_at - now).total_seconds()),
        path="/",
    )

    return {
        "ok": True,
        "user": {
            "user_id": user.user_id,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "role": user.role,
        },
    }


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    raw_token = request.cookies.get(SESSION_COOKIE_NAME)

    if raw_token:
        token_hash = hash_session_token(raw_token)

        session = (
            db.query(UserSession)
            .filter(UserSession.session_token_hash == token_hash)
            .first()
        )

        if session:
            db.delete(session)
            db.commit()

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
    )

    return {"ok": True}


@router.get("/me", response_model=UserMeOut)
def me(current_user: User = Depends(get_current_user)):
    return {
        "user_id": current_user.user_id,
        "full_name": current_user.full_name,
        "is_active": current_user.is_active,
        "role": current_user.role,
    }


@router.post("/change-password")
def change_password(
    payload: ChangePasswordIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must be different")

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()

    # Log out all sessions after password change
    db.query(UserSession).filter(UserSession.user_id == current_user.user_id).delete()
    db.commit()

    return {
        "ok": True,
        "message": "Password changed successfully. Please sign in again.",
    }