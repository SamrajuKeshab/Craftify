"""Category (with commission %), Product, Image, Variant, and Inventory models."""
from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.sellers.models import SellerProfile
from common.models import TimeStampedUUIDModel


class Category(TimeStampedUUIDModel):
    """
    Admin-managed craft category with per-category platform commission percentage.
    Uses PROTECT deletion policy while products reference it.
    """

    name = models.CharField(max_length=120, unique=True)
    slug = models.SlugField(max_length=140, unique=True)
    parent = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="subcategories",
    )
    description = models.TextField(blank=True, default="")
    commission_rate = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("10.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
            MaxValueValidator(Decimal("50.00")),
        ],
    )
    cover_image_url = models.URLField(max_length=500, blank=True, default="")
    cover_cloudinary_public_id = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        db_table = "categories"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["slug", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.commission_rate}%)"


class Product(TimeStampedUUIDModel):
    """
    Handmade craft listing created by an approved Seller and moderated by Admin.
    Soft-deleted (`is_deleted=True`) so future historical orders remain intact.
    """

    class ApprovalStatus(models.TextChoices):
        PENDING = "PENDING", "Pending Approval"
        APPROVED = "APPROVED", "Approved"
        REJECTED = "REJECTED", "Rejected"

    seller = models.ForeignKey(
        SellerProfile,
        on_delete=models.PROTECT,
        related_name="products",
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name="products",
    )
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    description = models.TextField()
    base_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("1.00"))],
    )
    discount_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    processing_days = models.PositiveSmallIntegerField(
        default=3,
        validators=[MinValueValidator(1), MaxValueValidator(60)],
    )
    is_customizable = models.BooleanField(default=False)
    is_made_to_order = models.BooleanField(default=False)
    is_one_of_a_kind = models.BooleanField(default=False)

    approval_status = models.CharField(
        max_length=16,
        choices=ApprovalStatus.choices,
        default=ApprovalStatus.PENDING,
        db_index=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="moderated_products",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True, default="")
    is_deleted = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = "products"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["approval_status", "category", "is_deleted"]),
            models.Index(fields=["seller", "is_deleted"]),
        ]

    @property
    def effective_price(self) -> Decimal:
        if self.discount_price is not None and self.discount_price < self.base_price:
            return self.discount_price
        return self.base_price

    def __str__(self) -> str:
        return f"{self.title} ({self.approval_status})"


class ProductImage(TimeStampedUUIDModel):
    """Cloudinary-hosted product photograph attached to a craft listing."""

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="images",
    )
    image_url = models.URLField(max_length=500)
    cloudinary_public_id = models.CharField(max_length=255)
    alt_text = models.CharField(max_length=200, blank=True, default="")
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "product_images"
        ordering = ["-is_primary", "sort_order", "created_at"]
        indexes = [
            models.Index(fields=["product", "sort_order"]),
        ]

    def __str__(self) -> str:
        return f"Image for {self.product.title}"


class ProductVariant(TimeStampedUUIDModel):
    """Purchasable craft option (size, color, material) with SKU and optional price override."""

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="variants",
    )
    sku = models.CharField(max_length=64, unique=True)
    label = models.CharField(max_length=120, default="Standard")
    size = models.CharField(max_length=60, blank=True, default="")
    color = models.CharField(max_length=60, blank=True, default="")
    material = models.CharField(max_length=80, blank=True, default="")
    price_override = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
    )
    weight_grams = models.PositiveIntegerField(default=500)
    dimensions_cm = models.CharField(max_length=80, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "product_variants"
        ordering = ["created_at"]

    @property
    def effective_price(self) -> Decimal:
        if self.price_override is not None:
            return self.price_override
        return self.product.effective_price

    def __str__(self) -> str:
        return f"{self.product.title} — {self.label} ({self.sku})"


class Inventory(TimeStampedUUIDModel):
    """1:1 stock tracking for each ProductVariant (prepared for atomic checkout locking)."""

    variant = models.OneToOneField(
        ProductVariant,
        on_delete=models.CASCADE,
        related_name="inventory",
    )
    quantity_available = models.PositiveIntegerField(default=0)
    quantity_reserved = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "inventory"

    def __str__(self) -> str:
        return f"Stock {self.quantity_available} (reserved {self.quantity_reserved}) for {self.variant.sku}"


class InventoryTransaction(TimeStampedUUIDModel):
    """Immutable inventory ledger tracking stock restocks, reservations, and deductions."""

    class ChangeType(models.TextChoices):
        RESTOCK = "RESTOCK", "Restock / Adjustment"
        RESERVE = "RESERVE", "Checkout Reserve"
        RELEASE = "RELEASE", "Reservation Release"
        DEDUCT = "DEDUCT", "Order Deduction"
        RETURN = "RETURN", "Return Restock"

    inventory = models.ForeignKey(
        Inventory,
        on_delete=models.PROTECT,
        related_name="transactions",
    )
    change_type = models.CharField(max_length=16, choices=ChangeType.choices)
    quantity_delta = models.IntegerField()
    note = models.CharField(max_length=255, blank=True, default="")

    class Meta:
        db_table = "inventory_transactions"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["inventory", "created_at"]),
        ]
