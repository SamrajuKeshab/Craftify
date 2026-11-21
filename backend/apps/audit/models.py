"""Immutable audit log model for security, onboarding, and admin governance."""
from django.conf import settings
from django.db import models

from common.models import TimeStampedUUIDModel


class AuditLog(TimeStampedUUIDModel):
    """
    Append-only record of sensitive platform mutations (seller approvals,
    rejections, account suspensions, moderation decisions).
    """

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=64, db_index=True)
    target_model = models.CharField(max_length=64, db_index=True)
    target_id = models.CharField(max_length=64, db_index=True)
    summary = models.CharField(max_length=255)
    metadata_json = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["target_model", "target_id"]),
            models.Index(fields=["action", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.action} by {self.actor_id} on {self.target_model}:{self.target_id}"
