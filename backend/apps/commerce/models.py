"""Week 7 models: BuyerAddress, Coupon, CouponUsage, Cart, CartItem, Wishlist, WishlistItem."""
from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator, RegexValidator
from django.db import models

from apps.catalog.models import Product, ProductVariant
from common.models import TimeStampedUUIDModel

INDIAN_PHONE_VALIDATOR = RegexValidator(
    regex=r"^[6-9]\d{9}$",
    message="Enter a valid 10-digit Indian mobile number starting with 6-9.",
)
INDIAN_PINCODE_VALIDATOR = RegexValidator(
    regex=r"^[1-9]\d{5}$",
    message="Enter a valid 6-digit Indian pincode.",
)
COUPON_CODE_VALIDATOR = RegexValidator(
    regex=r"^[A-Z0-9_-]{3,32}$",
    message="Coupon code must be 3-32 characters using A-Z, 0-9, hyphen, or underscore.",
)


class BuyerAddress(TimeStampedUUIDModel):
    """Persistent Indian delivery address book owned by an authenticated user."""

    class AddressLabel(models.TextChoices):
        HOME = "HOME", "Home"
        WORK = "WORK", "Work"
        OTHER = "OTHER", "Other"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="addresses",
    )
    label = models.CharField(
        max_length=16,
        choices=AddressLabel.choices,
        default=AddressLabel.HOME,
    )
    recipient_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=15, validators=[INDIAN_PHONE_VALIDATOR])
    line1 = models.CharField(max_length=220)
    line2 = models.CharField(max_length=220, blank=True, default="")
    landmark = models.CharField(max_length=140, blank=True, default="")
    city = models.CharField(max_length=80)
    state = models.CharField(max_length=80)
    pincode = models.CharField(max_length=6, validators=[INDIAN_PINCODE_VALIDATOR])
    is_default = models.BooleanField(default=False)

    class Meta:
        db_table = "buyer_addresses"
        ordering = ["-is_default", "-updated_at"]
        indexes = [
            models.Index(fields=["user", "is_default"]),
        ]

    def __str__(self) -> str:
        return f"{self.recipient_name} — {self.city} ({self.pincode})"


class Coupon(TimeStampedUUIDModel):
    """Admin-managed platform discount coupon with fixed-precision INR decimal math."""

    class Scope(models.TextChoices):
        PLATFORM = "PLATFORM", "Platform-Wide"
        SELLER = "SELLER", "Seller Studio"

    class DiscountType(models.TextChoices):
        PERCENT = "PERCENT", "Percentage (%)"
        FIXED = "FIXED", "Flat INR (₹)"

    code = models.CharField(
        max_length=32,
        unique=True,
        db_index=True,
        validators=[COUPON_CODE_VALIDATOR],
    )
    description = models.CharField(max_length=240, blank=True, default="")
    scope = models.CharField(
        max_length=16,
        choices=Scope.choices,
        default=Scope.PLATFORM,
    )
    discount_type = models.CharField(
        max_length=16,
        choices=DiscountType.choices,
        default=DiscountType.PERCENT,
    )
    value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("1.00"))],
    )
    min_order_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    max_discount_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("1.00"))],
    )
    valid_from = models.DateTimeField()
    valid_until = models.DateTimeField()
    max_uses = models.PositiveIntegerField(
        default=0,
        help_text="0 means unlimited platform redemptions.",
    )
    per_user_limit = models.PositiveSmallIntegerField(
        default=1,
        help_text="0 means unlimited redemptions per shopper.",
    )
    used_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="created_coupons",
    )

    class Meta:
        db_table = "coupons"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["code", "is_active"]),
            models.Index(fields=["valid_from", "valid_until"]),
        ]

    def __str__(self) -> str:
        return f"{self.code} ({self.discount_type} {self.value})"


class CouponUsage(TimeStampedUUIDModel):
    """Tracks per-user coupon redemptions (populated on checkout in Week 8; validated in Week 7)."""

    coupon = models.ForeignKey(
        Coupon,
        on_delete=models.PROTECT,
        related_name="usages",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="coupon_usages",
    )
    order_reference = models.CharField(max_length=64, blank=True, default="")
    discount_applied = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
    )

    class Meta:
        db_table = "coupon_usages"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["coupon", "user"]),
        ]

    def __str__(self) -> str:
        return f"{self.coupon.code} used by {self.user.username}"


class Cart(TimeStampedUUIDModel):
    """Persistent 1:1 shopping cart for an authenticated Craftify user."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cart",
    )
    applied_coupon = models.ForeignKey(
        Coupon,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="applied_carts",
    )

    class Meta:
        db_table = "carts"

    def __str__(self) -> str:
        return f"Cart({self.user.username})"


class CartItem(TimeStampedUUIDModel):
    """Variant-level item stored inside a user's persistent cart."""

    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name="items",
    )
    variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.CASCADE,
        related_name="cart_items",
    )
    quantity = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
    )
    customization_note = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        db_table = "cart_items"
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "variant"],
                name="unique_cart_variant",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.variant.sku} x {self.quantity}"


class Wishlist(TimeStampedUUIDModel):
    """Persistent 1:1 saved crafts list for an authenticated user."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="wishlist",
    )

    class Meta:
        db_table = "wishlists"

    def __str__(self) -> str:
        return f"Wishlist({self.user.username})"


class WishlistItem(TimeStampedUUIDModel):
    """Bookmarked handmade craft inside a user's persistent wishlist."""

    wishlist = models.ForeignKey(
        Wishlist,
        on_delete=models.CASCADE,
        related_name="items",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="wishlist_items",
    )

    class Meta:
        db_table = "wishlist_items"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["wishlist", "product"],
                name="unique_wishlist_product",
            ),
        ]

    def __str__(self) -> str:
        return f"WishlistItem({self.product.title})"
