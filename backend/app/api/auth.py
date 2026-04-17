from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models.user import User, UserSession
from app.schemas.auth import LoginIn, LoginOut, UserMeOut, ChangePasswordIn
from app.utils.security import (
    verify_password,
    new_session_token,
    hash_session_token,
    hash_password,
)
from app.utils.audit import log_activity
from app.utils.audit_constants import AuditAction, AuditModule

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


def get_cookie_settings(request: Request) -> dict:
    origin = (request.headers.get("origin") or "").lower()

    # Local development
    if "localhost" in origin or "127.0.0.1" in origin:
        return {
            "secure": False,
            "samesite": "lax",
        }

    # Production / Vercel / cross-site frontend
    return {
        "secure": True,
        "samesite": "none",
    }


def set_session_cookie(
    response: Response,
    request: Request,
    raw_token: str,
    max_age_seconds: int,
) -> None:
    cookie = get_cookie_settings(request)

    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=cookie["secure"],
        samesite=cookie["samesite"],
        max_age=max_age_seconds,
        expires=max_age_seconds,
        path="/",
    )


def clear_session_cookie(response: Response, request: Request) -> None:
    cookie = get_cookie_settings(request)

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
        secure=cookie["secure"],
        samesite=cookie["samesite"],
    )


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    delete_expired_sessions(db)

    raw_token = request.cookies.get(SESSION_COOKIE_NAME)

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    token_hash = hash_session_token(raw_token)

    session = (
        db.query(UserSession)
        .filter(UserSession.session_token_hash == token_hash)
        .first()
    )

    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    if session.expires_at < utc_now():
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired",
        )

    user = db.get(User, session.user_id)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    session.last_seen_at = utc_now()
    db.commit()

    return user


def require_viewer_or_above(current_user: User = Depends(get_current_user)) -> User:
    role = (current_user.role or "").upper()

    if role not in {"ADMIN", "OPERATOR", "VIEWER"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied",
        )

    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    role = (current_user.role or "").upper()

    if role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user


def require_operator_or_admin(current_user: User = Depends(get_current_user)) -> User:
    role = (current_user.role or "").upper()

    if role not in {"ADMIN", "OPERATOR"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operator access required",
        )

    return current_user


@router.post("/login", response_model=LoginOut)
def login(
    payload: LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    delete_expired_sessions(db)

    login_value = payload.login_id.strip()
    login_upper = login_value.upper()
    login_lower = login_value.lower()

    user = (
        db.query(User)
        .filter(
            or_(
                User.user_id == login_upper,
                User.email.isnot(None) & (User.email == login_lower),
            )
        )
        .first()
    )

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

    log_activity(
        db=db,
        request=request,
        user_id=user.user_id,
        action=AuditAction.LOGIN,
        module=AuditModule.USER,
        record_id=user.user_id,
        record_name=user.full_name,
        details="User logged in",
    )

    db.commit()

    max_age_seconds = int((expires_at - now).total_seconds())
    set_session_cookie(
        response=response,
        request=request,
        raw_token=raw_token,
        max_age_seconds=max_age_seconds,
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
    user_id = None
    full_name = None

    if raw_token:
        token_hash = hash_session_token(raw_token)

        session = (
            db.query(UserSession)
            .filter(UserSession.session_token_hash == token_hash)
            .first()
        )

        if session:
            user_id = session.user_id
            user = db.get(User, session.user_id)
            full_name = user.full_name if user else None

            log_activity(
                db=db,
                request=request,
                user_id=user_id,
                action=AuditAction.LOGOUT,
                module=AuditModule.USER,
                record_id=user_id,
                record_name=full_name,
                details="User logged out",
            )

            db.delete(session)
            db.commit()

    clear_session_cookie(response=response, request=request)

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
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must be different")

    current_user.password_hash = hash_password(payload.new_password)

    log_activity(
        db=db,
        request=request,
        user_id=current_user.user_id,
        action=AuditAction.PASSWORD_CHANGE,
        module=AuditModule.USER,
        record_id=current_user.user_id,
        record_name=current_user.full_name,
        details="User changed own password",
    )

    db.commit()

    db.query(UserSession).filter(
        UserSession.user_id == current_user.user_id
    ).delete()
    db.commit()

    return {
        "ok": True,
        "message": "Password changed successfully. Please sign in again.",
    }