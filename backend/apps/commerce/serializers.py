"""DRF serializers for Buyer Addresses, Persistent Cart, Wishlist, and Admin Coupons."""
import re
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.catalog.serializers import ProductDetailSerializer
from apps.commerce.models import BuyerAddress, Coupon, WishlistItem

INDIAN_PHONE_RE = re.compile(r"^[6-9]\d{9}$")
INDIAN_PINCODE_RE = re.compile(r"^[1-9]\d{5}$")
COUPON_CODE_RE = re.compile(r"^[A-Z0-9_-]{3,32}$")


class BuyerAddressSerializer(serializers.ModelSerializer):
    phone = serializers.CharField(max_length=20)
    pincode = serializers.CharField(max_length=12)

    class Meta:
        model = BuyerAddress
        fields = (
            "id",
            "label",
            "recipient_name",
            "phone",
            "line1",
            "line2",
            "landmark",
            "city",
            "state",
            "pincode",
            "is_default",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_recipient_name(self, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise serializers.ValidationError("Recipient name must be at least 2 characters.")
        return cleaned

    def validate_phone(self, value: str) -> str:
        digits = re.sub(r"[\s\-()]+", "", value.strip())
        if digits.startswith("+91"):
            digits = digits[3:]
        elif len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        if not INDIAN_PHONE_RE.match(digits):
            raise serializers.ValidationError(
                "Enter a valid 10-digit Indian mobile number starting with 6-9."
            )
        return digits

    def validate_line1(self, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 5:
            raise serializers.ValidationError("Enter house/flat number and street address.")
        return cleaned

    def validate_city(self, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise serializers.ValidationError("Enter a valid city name.")
        return cleaned

    def validate_state(self, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise serializers.ValidationError("Enter a valid Indian state or UT.")
        return cleaned

    def validate_pincode(self, value: str) -> str:
        cleaned = re.sub(r"\s+", "", value.strip())
        if not INDIAN_PINCODE_RE.match(cleaned):
            raise serializers.ValidationError("Enter a valid 6-digit Indian pincode.")
        return cleaned


class CartAddItemSerializer(serializers.Serializer):
    variant_id = serializers.UUIDField(required=False, allow_null=True)
    product_id = serializers.UUIDField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1, max_value=50, default=1)
    customization_note = serializers.CharField(
        required=False, allow_blank=True, max_length=300, default=""
    )

    def validate(self, attrs):
        if not attrs.get("variant_id") and not attrs.get("product_id"):
            raise serializers.ValidationError(
                "Either variant_id or product_id is required to add an item to cart."
            )
        attrs["customization_note"] = (attrs.get("customization_note") or "").strip()
        return attrs


class CartUpdateItemSerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=0, max_value=50, required=False)
    customization_note = serializers.CharField(
        required=False, allow_blank=True, max_length=300
    )

    def validate(self, attrs):
        if "quantity" not in attrs and "customization_note" not in attrs:
            raise serializers.ValidationError(
                "Provide quantity or customization_note to update this cart item."
            )
        if "customization_note" in attrs:
            attrs["customization_note"] = attrs["customization_note"].strip()
        return attrs


class CouponCodeInputSerializer(serializers.Serializer):
    code = serializers.CharField(min_length=1, max_length=32)

    def validate_code(self, value: str) -> str:
        cleaned = value.strip().upper()
        if not cleaned:
            raise serializers.ValidationError("Please enter a coupon code.")
        return cleaned


class WishlistToggleSerializer(serializers.Serializer):
    product_id = serializers.UUIDField()


class WishlistMoveToCartSerializer(serializers.Serializer):
    variant_id = serializers.UUIDField(required=False, allow_null=True)
    quantity = serializers.IntegerField(min_value=1, max_value=50, default=1)
    customization_note = serializers.CharField(
        required=False, allow_blank=True, max_length=300, default=""
    )


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductDetailSerializer(read_only=True)

    class Meta:
        model = WishlistItem
        fields = ("id", "created_at", "product")
        read_only_fields = fields


class AdminCouponReadSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True, default=None
    )
    computed_status = serializers.SerializerMethodField()

    class Meta:
        model = Coupon
        fields = (
            "id",
            "code",
            "description",
            "scope",
            "discount_type",
            "value",
            "min_order_amount",
            "max_discount_amount",
            "valid_from",
            "valid_until",
            "max_uses",
            "per_user_limit",
            "used_count",
            "is_active",
            "computed_status",
            "created_by_username",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_computed_status(self, obj: Coupon) -> str:
        now = timezone.now()
        if not obj.is_active:
            return "INACTIVE"
        if obj.max_uses > 0 and obj.used_count >= obj.max_uses:
            return "EXHAUSTED"
        if now > obj.valid_until:
            return "EXPIRED"
        if now < obj.valid_from:
            return "SCHEDULED"
        return "ACTIVE"


class AdminCouponWriteSerializer(serializers.Serializer):
    code = serializers.CharField(min_length=3, max_length=32)
    description = serializers.CharField(
        required=False, allow_blank=True, max_length=240, default=""
    )
    discount_type = serializers.ChoiceField(choices=Coupon.DiscountType.choices)
    value = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("1.00"),
    )
    min_order_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("0.00"),
        required=False,
        default=Decimal("0.00"),
    )
    max_discount_amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("1.00"),
        required=False,
        allow_null=True,
        default=None,
    )
    valid_from = serializers.DateTimeField()
    valid_until = serializers.DateTimeField()
    max_uses = serializers.IntegerField(min_value=0, max_value=1000000, default=0)
    per_user_limit = serializers.IntegerField(min_value=0, max_value=100, default=1)
    is_active = serializers.BooleanField(required=False, default=True)

    def validate_code(self, value: str) -> str:
        cleaned = value.strip().upper()
        if not COUPON_CODE_RE.match(cleaned):
            raise serializers.ValidationError(
                "Coupon code must be 3-32 characters (A-Z, 0-9, hyphen, or underscore)."
            )
        qs = Coupon.objects.filter(code__iexact=cleaned)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A coupon with this code already exists.")
        return cleaned

    def validate_max_discount_amount(self, value):
        if value in ("", None):
            return None
        return value

    def validate(self, attrs):
        discount_type = attrs.get(
            "discount_type",
            self.instance.discount_type if self.instance else Coupon.DiscountType.PERCENT,
        )
        value = attrs.get("value", self.instance.value if self.instance else None)
        valid_from = attrs.get(
            "valid_from", self.instance.valid_from if self.instance else None
        )
        valid_until = attrs.get(
            "valid_until", self.instance.valid_until if self.instance else None
        )

        if discount_type == Coupon.DiscountType.PERCENT and value is not None:
            if value > Decimal("90.00"):
                raise serializers.ValidationError(
                    {"value": ["Percentage discount cannot exceed 90%."]}
                )

        if valid_from and valid_until and valid_until <= valid_from:
            raise serializers.ValidationError(
                {"valid_until": ["Expiry date/time must be later than the start date/time."]}
            )

        if discount_type == Coupon.DiscountType.FIXED:
            # Flat coupons don't need a separate max cap
            if "max_discount_amount" in attrs:
                attrs["max_discount_amount"] = None

        return attrs
