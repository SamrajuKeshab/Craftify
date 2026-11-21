"""Seller onboarding, verification documents, and approved seller profile models."""
from decimal import Decimal

from django.conf import settings
from django.db import models

from apps.sellers.validators import verification_document_upload_path
from common.models import TimeStampedUUIDModel


class SellerApplication(TimeStampedUUIDModel):
    """
    Artisan seller onboarding request submitted by a verified BUYER.
    Reviewed exclusively by platform Admins.
    """

    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending Review"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="seller_applications",
    )
    shop_name = models.CharField(max_length=140)
    primary_category = models.CharField(max_length=100)
    bio = models.TextField()
    pickup_address = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    pincode = models.CharField(max_length=6)
    pan_number = models.CharField(max_length=10)
    gstin = models.CharField(max_length=15, blank=True, default="")
    bank_account_masked = models.CharField(max_length=24, blank=True, default="")
    ifsc_code = models.CharField(max_length=11, blank=True, default="")
    accepted_agreement = models.BooleanField(default=False)

    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reviewed_seller_applications",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True, default="")

    class Meta:
        db_table = "seller_applications"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["user", "status"]),
        ]

    def __str__(self) -> str:
        return f"{self.shop_name} ({self.status})"


class SellerVerificationDocument(TimeStampedUUIDModel):
    """KYC or artisan portfolio attachment linked to a SellerApplication."""

    class DocType(models.TextChoices):
        PAN_CARD = "PAN_CARD", "PAN Card"
        GST_CERTIFICATE = "GST_CERTIFICATE", "GST Certificate"
        ID_PROOF = "ID_PROOF", "Government ID Proof"
        CRAFT_PORTFOLIO = "CRAFT_PORTFOLIO", "Craft Studio Portfolio"

    application = models.ForeignKey(
        SellerApplication,
        on_delete=models.CASCADE,
        related_name="documents",
    )
    doc_type = models.CharField(
        max_length=32,
        choices=DocType.choices,
        default=DocType.PAN_CARD,
    )
    file = models.FileField(upload_to=verification_document_upload_path)
    original_filename = models.CharField(max_length=200, blank=True, default="")
    file_size_bytes = models.PositiveIntegerField(default=0)
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "seller_verification_docs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["application"]),
        ]

    def __str__(self) -> str:
        return f"{self.doc_type} for {self.application.shop_name}"


class SellerProfile(TimeStampedUUIDModel):
    """
    Authoritative shop profile initialized when an Admin approves a SellerApplication.
    Uses PROTECT deletion policy to preserve historical orders and ledger entries.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="seller_profile",
    )
    application = models.OneToOneField(
        SellerApplication,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="approved_profile",
    )
    shop_name = models.CharField(max_length=140, unique=True)
    slug = models.SlugField(max_length=160, unique=True)
    primary_category = models.CharField(max_length=100, blank=True, default="")
    description = models.TextField(blank=True, default="")
    city = models.CharField(max_length=100, blank=True, default="")
    state = models.CharField(max_length=100, blank=True, default="")
    pickup_address_json = models.JSONField(default=dict, blank=True)
    bank_account_masked = models.CharField(max_length=24, blank=True, default="")
    ifsc_code = models.CharField(max_length=11, blank=True, default="")
    agreement_accepted_at = models.DateTimeField(null=True, blank=True)
    is_suspended = models.BooleanField(default=False, db_index=True)
    suspension_reason = models.CharField(max_length=255, blank=True, default="")
    rating_avg = models.DecimalField(
        max_digits=3,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    class Meta:
        db_table = "seller_profiles"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["slug", "is_suspended"]),
        ]

    def __str__(self) -> str:
        return f"{self.shop_name} (@{self.user.username})"
