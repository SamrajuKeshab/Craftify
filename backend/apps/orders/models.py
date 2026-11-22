"""Week 8 models: Multi-vendor Order, SellerSuborder, OrderItem, Payment, PaymentTransaction."""
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.catalog.models import Product, ProductVariant
from apps.commerce.models import Coupon
from apps.sellers.models import SellerProfile
from common.models import TimeStampedUUIDModel


class Order(TimeStampedUUIDModel):
    """
    Parent Buyer Order that splits atomically into one or more SellerSuborders.
    Uses PROTECT deletion policy — financial and order records are never hard-deleted.
    """

    class PaymentMethod(models.TextChoices):
        RAZORPAY = "RAZORPAY", "Razorpay Prepaid"
        COD = "COD", "Cash on Delivery"

    class PaymentStatus(models.TextChoices):
        PENDING = "PENDING", "Pending Payment"
        PAID = "PAID", "Paid"
        COD_PENDING = "COD_PENDING", "COD Pending Collection"
        FAILED = "FAILED", "Payment Failed"
        REFUNDED = "REFUNDED", "Refunded"

    class OverallStatus(models.TextChoices):
        PENDING_PAYMENT = "PENDING_PAYMENT", "Awaiting Payment"
        CONFIRMED = "CONFIRMED", "Confirmed"
        PROCESSING = "PROCESSING", "Processing"
        SHIPPED = "SHIPPED", "Shipped"
        PARTIALLY_DELIVERED = "PARTIALLY_DELIVERED", "Partially Delivered"
        DELIVERED = "DELIVERED", "Delivered"
        CANCELLED = "CANCELLED", "Cancelled"
        PAYMENT_FAILED = "PAYMENT_FAILED", "Payment Failed"

    order_number = models.CharField(max_length=32, unique=True, db_index=True)
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="orders",
    )
    shipping_address_snapshot = models.JSONField(default=dict)
    coupon = models.ForeignKey(
        Coupon,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="orders",
    )
    coupon_code_snapshot = models.CharField(max_length=32, blank=True, default="")
    currency = models.CharField(max_length=3, default="INR")
    subtotal_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    discount_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    shipping_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    total_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    payment_method = models.CharField(
        max_length=16, choices=PaymentMethod.choices, default=PaymentMethod.RAZORPAY
    )
    payment_status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
        db_index=True,
    )
    overall_status = models.CharField(
        max_length=24,
        choices=OverallStatus.choices,
        default=OverallStatus.PENDING_PAYMENT,
        db_index=True,
    )
    idempotency_key = models.CharField(
        max_length=80, null=True, blank=True, unique=True
    )
    stock_state = models.CharField(
        max_length=16,
        default="RESERVED",
        help_text="Internal stock lifecycle state: RESERVED, DEDUCTED, RELEASED.",
    )

    class Meta:
        db_table = "orders"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["buyer", "-created_at"]),
            models.Index(fields=["overall_status", "payment_status"]),
        ]

    def __str__(self) -> str:
        return f"{self.order_number} ({self.overall_status} · ₹{self.total_amount})"


class SellerSuborder(TimeStampedUUIDModel):
    """
    Per-artisan suborder split from a parent Order so each studio fulfils independently
    with snapshotted category commission and net seller payout amounts.
    """

    class FulfilmentStatus(models.TextChoices):
        PENDING_PAYMENT = "PENDING_PAYMENT", "Awaiting Payment"
        PENDING = "PENDING", "Pending Acceptance"
        ACCEPTED = "ACCEPTED", "Accepted by Studio"
        PACKED = "PACKED", "Packed & Ready"
        SHIPPED = "SHIPPED", "Shipped"
        DELIVERED = "DELIVERED", "Delivered"
        CANCELLED = "CANCELLED", "Cancelled"
        RETURNED = "RETURNED", "Returned"

    parent_order = models.ForeignKey(
        Order,
        on_delete=models.PROTECT,
        related_name="suborders",
    )
    seller = models.ForeignKey(
        SellerProfile,
        on_delete=models.PROTECT,
        related_name="suborders",
    )
    suborder_number = models.CharField(max_length=40, unique=True, db_index=True)
    seller_shop_name_snapshot = models.CharField(max_length=140)
    subtotal_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    discount_share = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    shipping_share = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    commission_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    net_seller_amount = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00")
    )
    fulfilment_status = models.CharField(
        max_length=20,
        choices=FulfilmentStatus.choices,
        default=FulfilmentStatus.PENDING_PAYMENT,
        db_index=True,
    )
    seller_notes = models.CharField(max_length=300, blank=True, default="")
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "seller_suborders"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["seller", "fulfilment_status"]),
            models.Index(fields=["parent_order"]),
        ]

    def __str__(self) -> str:
        return f"{self.suborder_number} — {self.seller_shop_name_snapshot}"


class OrderItem(TimeStampedUUIDModel):
    """Immutable historical line item snapshot inside a SellerSuborder."""

    suborder = models.ForeignKey(
        SellerSuborder,
        on_delete=models.PROTECT,
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_items",
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="order_items",
    )
    product_title_snapshot = models.CharField(max_length=200)
    product_slug_snapshot = models.CharField(max_length=220, blank=True, default="")
    product_image_snapshot = models.URLField(max_length=500, blank=True, default="")
    variant_label_snapshot = models.CharField(max_length=120, default="Standard")
    variant_sku_snapshot = models.CharField(max_length=64, blank=True, default="")
    unit_price_snapshot = models.DecimalField(max_digits=12, decimal_places=2)
    commission_rate_snapshot = models.DecimalField(
        max_digits=5, decimal_places=2, default=Decimal("10.00")
    )
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    line_total = models.DecimalField(max_digits=12, decimal_places=2)
    customization_note = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        db_table = "order_items"
        ordering = ["created_at"]

    def __str__(self) -> str:
        return f"{self.product_title_snapshot} x {self.quantity}"


class Payment(TimeStampedUUIDModel):
    """Payment record linked to an Order (Razorpay Prepaid or Cash on Delivery)."""

    class Provider(models.TextChoices):
        RAZORPAY = "RAZORPAY", "Razorpay"
        COD = "COD", "Cash on Delivery"

    class Status(models.TextChoices):
        CREATED = "CREATED", "Created"
        AUTHORIZED = "AUTHORIZED", "Authorized"
        CAPTURED = "CAPTURED", "Captured"
        COD_PENDING = "COD_PENDING", "COD Pending"
        FAILED = "FAILED", "Failed"
        REFUNDED = "REFUNDED", "Refunded"

    order = models.ForeignKey(
        Order,
        on_delete=models.PROTECT,
        related_name="payments",
    )
    provider = models.CharField(max_length=16, choices=Provider.choices)
    razorpay_order_id = models.CharField(
        max_length=80, null=True, blank=True, unique=True, db_index=True
    )
    razorpay_payment_id = models.CharField(
        max_length=80, null=True, blank=True, unique=True, db_index=True
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency = models.CharField(max_length=3, default="INR")
    status = models.CharField(
        max_length=16, choices=Status.choices, default=Status.CREATED, db_index=True
    )
    failure_reason = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        db_table = "payments"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.provider} {self.status} ₹{self.amount} ({self.order.order_number})"


class PaymentTransaction(TimeStampedUUIDModel):
    """Append-only audit trail for payment creations, signature checks, and idempotent webhooks."""

    payment = models.ForeignKey(
        Payment,
        on_delete=models.PROTECT,
        related_name="transactions",
    )
    idempotency_key = models.CharField(max_length=120, unique=True)
    webhook_event_id = models.CharField(
        max_length=120, null=True, blank=True, unique=True
    )
    event_type = models.CharField(max_length=64)
    raw_payload = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "payment_transactions"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.event_type} ({self.payment_id})"
