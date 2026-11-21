"""Helper service to record immutable platform audit entries."""
from typing import Any

from apps.audit.models import AuditLog


def extract_client_ip(request) -> str | None:
    """Safely extract client IP address from an incoming Django/DRF request."""
    if request is None:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def record_audit_log(
    *,
    actor,
    action: str,
    target_model: str,
    target_id: Any,
    summary: str,
    metadata: dict | None = None,
    request=None,
) -> AuditLog:
    """Append an immutable audit log entry inside the current transaction."""
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        target_model=target_model,
        target_id=str(target_id),
        summary=summary[:255],
        metadata_json=metadata or {},
        ip_address=extract_client_ip(request),
    )
