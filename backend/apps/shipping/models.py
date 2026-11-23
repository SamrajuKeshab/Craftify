"""Week 9 models: Shipment, ShipmentEvent, and ReturnRequest (7-Day Return Window)."""
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.orders.models import OrderItem, SellerSuborder
from common.models import TimeStampedUUIDModel


class Shipment(TimeStampedUUIDModel):
    """
    Courier dispatch record linked 1:1 to a SellerSuborder.
    Stores Indian courier details, AWB/tracking number, ETA, and authoritative delivery time.
    """

    class Status(models.TextChoices):
        DISPATCHED = "DISPATCHED", "Dispatched from Studio"
        IN_TRANSIT = "IN_TRANSIT", "In Transit"
        OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY", "Out for Delivery"
        DELIVERY_ATTEMPTED = "DELIVERY_ATTEMPTED", "Delivery Attempted"
        DELIVERED = "DELIVERED", "Delivered"

    suborder = models.OneToOneField(
        SellerSuborder,
        on_delete=models.PROTECT,
        related_name="shipment",
    )
    courier_name = models.CharField(max_length=80)
    tracking_number = models.CharField(max_length=100, db_index=True)
    tracking_url = models.URLField(max_length=500, blank=True, default="")
    current_status = models.CharField(
        max_length=24,
        choices=Status.choices,
        default=Status.DISPATCHED,
        db_index=True,
    )
    shipped_at = models.DateTimeField()
    estimated_delivery_date = models.DateField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    dispatch_notes = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        db_table = "shipments"
        ordering = ["-shipped_at"]
        indexes = [
            models.Index(fields=["tracking_number"]),
            models.Index(fields=["current_status", "-shipped_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.courier_name} · {self.tracking_number} ({self.current_status})"


class ShipmentEvent(TimeStampedUUIDModel):
    """Chronological parcel tracking milestone appended to a Shipment."""

    shipment = models.ForeignKey(
        Shipment,
        on_delete=models.CASCADE,
        related_name="events",
    )
    status = models.CharField(
        max_length=24,
        choices=Shipment.Status.choices,
        default=Shipment.Status.IN_TRANSIT,
    )
    location = models.CharField(max_length=120, blank=True, default="")
    notes = models.CharField(max_length=300, blank=True, default="")
    event_timestamp = models.DateTimeField()

    class Meta:
        db_table = "shipment_events"
        ordering = ["-event_timestamp", "-created_at"]
        indexes = [
            models.Index(fields=["shipment", "-event_timestamp"]),
        ]

    def __str__(self) -> str:
        return f"{self.status} @ {self.location or 'Hub'} ({self.shipment.tracking_number})"


class ReturnRequest(TimeStampedUUIDModel):
    """
    Item-level 7-day post-delivery return request submitted by a Buyer and
    resolved directly by the Seller Studio (with immutable AuditLog oversight).
    """

    class Reason(models.TextChoices):
        DAMAGED = "DAMAGED", "Damaged in Transit"
        DEFECTIVE = "DEFECTIVE", "Defective Craftsmanship"
        WRONG_ITEM = "WRONG_ITEM", "Wrong Item Received"
        NOT_AS_DESCRIBED = "NOT_AS_DESCRIBED", "Not as Described"
        SIZE_OR_FIT = "SIZE_OR_FIT", "Size or Dimension Mismatch"

    class Status(models.TextChoices):
        REQUESTED = "REQUESTED", "Requested"
        APPROVED = "APPROVED", "Approved by Studio"
        PICKED_UP = "PICKED_UP", "Picked Up / In Return Transit"
        COMPLETED = "COMPLETED", "Returned & Completed"
        REJECTED = "REJECTED", "Rejected"

    return_number = models.CharField(max_length=36, unique=True, db_index=True)
    suborder = models.ForeignKey(
        SellerSuborder,
        on_delete=models.PROTECT,
        related_name="return_requests",
    )
    order_item = models.ForeignKey(
        OrderItem,
        on_delete=models.PROTECT,
        related_name="return_requests",
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="return_requests",
    )
    reason = models.CharField(max_length=24, choices=Reason.choices)
    description = models.TextField(max_length=1000)
    evidence_urls = models.JSONField(default=list, blank=True)
    evidence_public_ids = models.JSONField(default=list, blank=True)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)], default=1)
    refund_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.REQUESTED,
        db_index=True,
    )
    seller_response_note = models.CharField(max_length=400, blank=True, default="")
    restocked = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "return_requests"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["suborder", "status"]),
            models.Index(fields=["buyer", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.return_number} ({self.status} · ₹{self.refund_amount})"
