from fastapi import APIRouter, Depends

from app.api.auth import require_operator_or_admin
from app.models.user import User
from app.utils.audit_constants import AuditAction, AuditModule

router = APIRouter(prefix="/audit-meta", tags=["Audit Meta"])


@router.get("/")
def get_audit_meta(current_user: User = Depends(require_operator_or_admin)):
    return {
        "modules": [m.value for m in AuditModule],
        "actions": [a.value for a in AuditAction],
    }
    