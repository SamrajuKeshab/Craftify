"""Week 10 models: Immutable Financial Ledger, Buyer Refund Records, and Seller Payouts."""
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from apps.orders.models import Order, SellerSuborder
from apps.sellers.models import SellerProfile
from apps.shipping.models import ReturnRequest
from common.models import TimeStampedUUIDModel


class RefundRecord(TimeStampedUUIDModel):
    """
    Authoritative buyer refund record generated automatically when a delivered
    7-day return completes or when a paid Razorpay order/suborder is cancelled.
    """

    class TriggerSource(models.TextChoices):
        RETURN_COMPLETED = "RETURN_COMPLETED", "7-Day Return Completed"
        BUYER_CANCELLATION = "BUYER_CANCELLATION", "Buyer Order Cancellation"
        SELLER_CANCELLATION = "SELLER_CANCELLATION", "Seller Suborder Cancellation"

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending Processing"
        PROCESSED = "PROCESSED", "Refund Processed"
        FAILED = "FAILED", "Refund Failed"

    refund_number = models.CharField(max_length=32, unique=True, db_index=True)
    order = models.ForeignKey(
        Order,
        on_delete=models.PROTECT,
        related_name="refund_records",
    )
    suborder = models.ForeignKey(
        SellerSuborder,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="refund_records",
    )
    return_request = models.OneToOneField(
        ReturnRequest,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="refund_record",
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="refund_records",
    )
    payment_method = models.CharField(
        max_length=16,
        choices=Order.PaymentMethod.choices,
        default=Order.PaymentMethod.RAZORPAY,
    )
    trigger_source = models.CharField(
        max_length=24,
        choices=TriggerSource.choices,
        default=TriggerSource.RETURN_COMPLETED,
        db_index=True,
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    commission_reversed = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    net_seller_deduction = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    idempotency_key = models.CharField(max_length=140, unique=True)
    gateway_refund_id = models.CharField(max_length=100, blank=True, default="")
    admin_notes = models.CharField(max_length=400, blank=True, default="")
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="processed_refunds",
    )
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "finance_refund_records"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "-created_at"]),
            models.Index(fields=["buyer", "-created_at"]),
            models.Index(fields=["order"]),
        ]

    def __str__(self) -> str:
        return f"{self.refund_number} · ₹{self.amount} ({self.status})"


class SellerPayout(TimeStampedUUIDModel):
    """
    Artisan payout withdrawal request from released/available seller balance to
    the verified bank account & IFSC snapshotted from SellerProfile.
    """

    class Status(models.TextChoices):
        REQUESTED = "REQUESTED", "Requested"
        PROCESSING = "PROCESSING", "Processing"
        PAID = "PAID", "Paid"
        REJECTED = "REJECTED", "Rejected"

    payout_number = models.CharField(max_length=32, unique=True, db_index=True)
    seller = models.ForeignKey(
        SellerProfile,
        on_delete=models.PROTECT,
        related_name="payouts",
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("1.00"))],
    )
    bank_account_masked = models.CharField(max_length=32)
    ifsc_code = models.CharField(max_length=16)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.REQUESTED,
        db_index=True,
    )
    utr_reference = models.CharField(max_length=80, blank=True, default="")
    seller_notes = models.CharField(max_length=300, blank=True, default="")
    admin_notes = models.CharField(max_length=400, blank=True, default="")
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="processed_payouts",
    )
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "finance_seller_payouts"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["seller", "-created_at"]),
            models.Index(fields=["status", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.payout_number} · {self.seller.shop_name} · ₹{self.amount} ({self.status})"


class LedgerEntry(TimeStampedUUIDModel):
    """
    Append-only INR financial ledger tracking delivered seller credits (with 7-day
    settlement hold), category platform commissions, return refund debits, and payouts.
    """

    class EntryType(models.TextChoices):
        SALE_CREDIT = "SALE_CREDIT", "Delivered Sale Credit"
        PLATFORM_COMMISSION = "PLATFORM_COMMISSION", "Platform Commission"
        COMMISSION_REVERSAL = "COMMISSION_REVERSAL", "Commission Reversal"
        REFUND_DEBIT = "REFUND_DEBIT", "Return Refund Debit"
        PAYOUT_DEBIT = "PAYOUT_DEBIT", "Seller Payout Debit"
        PAYOUT_REVERSAL = "PAYOUT_REVERSAL", "Rejected Payout Reversal"

    class Direction(models.TextChoices):
        CREDIT = "CREDIT", "Credit"
        DEBIT = "DEBIT", "Debit"

    seller = models.ForeignKey(
        SellerProfile,
        on_delete=models.PROTECT,
        related_name="ledger_entries",
    )
    suborder = models.ForeignKey(
        SellerSuborder,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )
    return_request = models.ForeignKey(
        ReturnRequest,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )
    refund = models.ForeignKey(
        RefundRecord,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )
    payout = models.ForeignKey(
        SellerPayout,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ledger_entries",
    )
    entry_type = models.CharField(
        max_length=24,
        choices=EntryType.choices,
        db_index=True,
    )
    direction = models.CharField(
        max_length=8,
        choices=Direction.choices,
        default=Direction.CREDIT,
    )
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    available_at = models.DateTimeField(null=True, blank=True, db_index=True)
    hold_released_early = models.BooleanField(default=False)
    idempotency_key = models.CharField(max_length=140, unique=True)
    description = models.CharField(max_length=300)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "finance_ledger_entries"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["seller", "entry_type", "-created_at"]),
            models.Index(fields=["seller", "available_at"]),
            models.Index(fields=["entry_type", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.entry_type} · {self.seller.shop_name} · ₹{self.amount}"
