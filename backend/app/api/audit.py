from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.auth import require_admin
from app.core.database import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.utils.audit_constants import AuditAction, AuditModule

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/")
def get_logs(
    user_id: str | None = Query(default=None),
    module: str | None = Query(default=None),
    action: str | None = Query(default=None),
    record_id: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    query = db.query(AuditLog)

    if user_id:
        query = query.filter(AuditLog.user_id == user_id.strip().upper())

    if module:
        query = query.filter(AuditLog.module == module.strip().upper())

    if action:
        query = query.filter(AuditLog.action == action.strip().upper())

    if record_id:
        query = query.filter(AuditLog.record_id == record_id.strip().upper())

    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)

    if date_to:
        query = query.filter(AuditLog.created_at <= date_to)

    rows = (
        query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [
        {
            "id": row.id,
            "created_at": row.created_at,
            "user_id": row.user_id,
            "action": row.action,
            "module": row.module,
            "record_id": row.record_id,
            "record_name": row.record_name,
            "details": row.details,
            "old_values": row.old_values,
            "new_values": row.new_values,
            "ip_address": row.ip_address,
            "user_agent": row.user_agent,
        }
        for row in rows
    ]


@router.get("/meta")
def get_audit_meta(
    current_user: User = Depends(require_admin),
):
    return {
        "modules": [item.value for item in AuditModule],
        "actions": [item.value for item in AuditAction],
    }