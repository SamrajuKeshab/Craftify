"""Week 11 model: Per-user persistent in-app Notification inbox."""
from django.conf import settings
from django.db import models

from common.models import TimeStampedUUIDModel


class Notification(TimeStampedUUIDModel):
    """
    Persistent in-app notification delivered to a specific Buyer, Seller, or Admin
    when marketplace events occur (shipments, deliveries, returns, refunds, payouts, reviews).
    """

    class Category(models.TextChoices):
        ORDER = "ORDER", "Order"
        SHIPPING = "SHIPPING", "Shipping"
        RETURN = "RETURN", "Return"
        FINANCE = "FINANCE", "Finance & Payout"
        REVIEW = "REVIEW", "Verified Review"
        GOVERNANCE = "GOVERNANCE", "Governance"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    category = models.CharField(
        max_length=16,
        choices=Category.choices,
        default=Category.ORDER,
        db_index=True,
    )
    title = models.CharField(max_length=160)
    message = models.CharField(max_length=400)
    action_url = models.CharField(max_length=255, blank=True, default="")
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "notifications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"[{self.category}] {self.title} -> @{self.recipient.username}"
