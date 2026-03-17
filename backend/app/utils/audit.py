from fastapi import Request
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog


def get_request_meta(request: Request | None):
    if not request:
        return None, None

    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    return ip, user_agent


def safe_dict(data: dict | None, max_len: int = 2000):
    """
    Prevent very large payloads from breaking audit logs.
    """
    if not data:
        return None

    try:
        text = str(data)
        if len(text) > max_len:
            return {"truncated": True}
        return data
    except Exception:
        return {"error": "invalid_data"}


def log_activity(
    db: Session,
    request: Request | None,
    user_id: str,
    action: str,
    module: str,
    record_id: str | None = None,
    record_name: str | None = None,
    details: str | None = None,
    old_values: dict | None = None,
    new_values: dict | None = None,
):
    try:
        ip, user_agent = get_request_meta(request)

        log = AuditLog(
            user_id=user_id.strip().upper(),
            action=action.strip().upper(),
            module=module.strip().upper(),
            record_id=record_id.strip().upper() if record_id else None,
            record_name=record_name.strip().upper() if record_name else None,
            details=details,
            old_values=safe_dict(old_values),
            new_values=safe_dict(new_values),
            ip_address=ip,
            user_agent=user_agent,
        )

        db.add(log)

    except Exception as e:
        # NEVER break main business flow due to logging
        print("AUDIT LOG ERROR:", str(e))