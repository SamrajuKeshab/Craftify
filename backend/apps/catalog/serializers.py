"""DRF serializers for Categories (with Commission %), Products, Variants, Images & Moderation."""
import json
from decimal import Decimal

from rest_framework import serializers

from apps.catalog.models import Category, Product, ProductImage, ProductVariant
from apps.sellers.models import SellerProfile


class PublicShopSerializer(serializers.ModelSerializer):
    """Public storefront studio profile — never exposes KYC, pickup address, or payout bank data."""

    approved_product_count = serializers.SerializerMethodField()

    class Meta:
        model = SellerProfile
        fields = (
            "id",
            "shop_name",
            "slug",
            "primary_category",
            "description",
            "city",
            "state",
            "rating_avg",
            "approved_product_count",
            "created_at",
        )
        read_only_fields = fields

    def get_approved_product_count(self, obj) -> int:
        if hasattr(obj, "approved_count"):
            return obj.approved_count
        return obj.products.filter(
            approval_status=Product.ApprovalStatus.APPROVED,
            is_deleted=False,
            category__is_active=True,
        ).count()


class CategorySerializer(serializers.ModelSerializer):
    parent_name = serializers.CharField(source="parent.name", read_only=True, default=None)
    approved_product_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = (
            "id",
            "name",
            "slug",
            "parent",
            "parent_name",
            "description",
            "commission_rate",
            "cover_image_url",
            "is_active",
            "approved_product_count",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_approved_product_count(self, obj) -> int:
        if hasattr(obj, "approved_count"):
            return obj.approved_count
        return obj.products.filter(
            approval_status=Product.ApprovalStatus.APPROVED,
            is_deleted=False,
            seller__is_suspended=False,
        ).count()


class AdminCategoryWriteSerializer(serializers.Serializer):
    name = serializers.CharField(min_length=2, max_length=120)
    parent = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(), required=False, allow_null=True
    )
    description = serializers.CharField(required=False, allow_blank=True, default="")
    commission_rate = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        min_value=Decimal("0.00"),
        max_value=Decimal("50.00"),
    )
    is_active = serializers.BooleanField(required=False, default=True)
    cover_image = serializers.FileField(required=False, allow_null=True)


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = (
            "id",
            "image_url",
            "alt_text",
            "sort_order",
            "is_primary",
            "created_at",
        )
        read_only_fields = fields


class ProductVariantSerializer(serializers.ModelSerializer):
    quantity_available = serializers.SerializerMethodField()
    effective_price = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = (
            "id",
            "sku",
            "label",
            "size",
            "color",
            "material",
            "price_override",
            "effective_price",
            "weight_grams",
            "dimensions_cm",
            "is_active",
            "quantity_available",
        )
        read_only_fields = fields

    def get_quantity_available(self, obj) -> int:
        inv = getattr(obj, "inventory", None)
        return inv.quantity_available if inv else 0

    def get_effective_price(self, obj) -> str:
        return f"{obj.effective_price:.2f}"


class ProductDetailSerializer(serializers.ModelSerializer):
    """Unified read serializer for Storefront, Seller Catalog, and Admin Moderation."""

    category_id = serializers.UUIDField(source="category.id", read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    category_slug = serializers.CharField(source="category.slug", read_only=True)
    category_commission_rate = serializers.DecimalField(
        source="category.commission_rate",
        max_digits=5,
        decimal_places=2,
        read_only=True,
    )
    seller_id = serializers.UUIDField(source="seller.id", read_only=True)
    seller_shop_name = serializers.CharField(source="seller.shop_name", read_only=True)
    seller_slug = serializers.CharField(source="seller.slug", read_only=True)
    seller_city = serializers.CharField(source="seller.city", read_only=True)
    seller_state = serializers.CharField(source="seller.state", read_only=True)
    reviewed_by_username = serializers.CharField(
        source="reviewed_by.username", read_only=True, default=None
    )
    effective_price = serializers.SerializerMethodField()
    primary_image_url = serializers.SerializerMethodField()
    total_stock = serializers.SerializerMethodField()
    images = ProductImageSerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "title",
            "slug",
            "description",
            "category_id",
            "category_name",
            "category_slug",
            "category_commission_rate",
            "seller_id",
            "seller_shop_name",
            "seller_slug",
            "seller_city",
            "seller_state",
            "base_price",
            "discount_price",
            "effective_price",
            "processing_days",
            "is_customizable",
            "is_made_to_order",
            "is_one_of_a_kind",
            "approval_status",
            "reviewed_by_username",
            "reviewed_at",
            "review_notes",
            "primary_image_url",
            "total_stock",
            "images",
            "variants",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_effective_price(self, obj) -> str:
        return f"{obj.effective_price:.2f}"

    def get_primary_image_url(self, obj) -> str:
        imgs = list(obj.images.all())
        if not imgs:
            return ""
        primary = next((img for img in imgs if img.is_primary), imgs[0])
        return primary.image_url

    def get_total_stock(self, obj) -> int:
        total = 0
        for variant in obj.variants.all():
            if variant.is_active:
                inv = getattr(variant, "inventory", None)
                if inv:
                    total += inv.quantity_available
        return total


class SellerProductWriteSerializer(serializers.Serializer):
    """Validates Seller product creation/updates across both JSON and multipart/form-data."""

    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all())
    title = serializers.CharField(min_length=3, max_length=200)
    description = serializers.CharField(min_length=15, max_length=4000)
    base_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("1.00"),
    )
    discount_price = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("1.00"),
        required=False,
        allow_null=True,
    )
    processing_days = serializers.IntegerField(min_value=1, max_value=60, default=3)
    is_customizable = serializers.BooleanField(required=False, default=False)
    is_made_to_order = serializers.BooleanField(required=False, default=False)
    is_one_of_a_kind = serializers.BooleanField(required=False, default=False)
    variants = serializers.JSONField(required=False)

    def validate_discount_price(self, value):
        if value in ("", None):
            return None
        return value

    def validate_variants(self, value):
        if value in (None, ""):
            return []
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except ValueError:
                raise serializers.ValidationError("Variants must be valid JSON.")
        if not isinstance(value, list):
            raise serializers.ValidationError("Variants must be a list of options.")
        return value

    def validate(self, attrs):
        base_price = attrs.get("base_price")
        discount_price = attrs.get("discount_price")
        if base_price is None and self.instance is not None:
            base_price = self.instance.base_price
        if discount_price is not None and base_price is not None and discount_price >= base_price:
            raise serializers.ValidationError(
                {"discount_price": ["Discount price must be lower than the base price."]}
            )
        return attrs


class AdminProductModerationSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["APPROVE", "REJECT"])
    review_notes = serializers.CharField(
        required=False, allow_blank=True, max_length=1000, default=""
    )
