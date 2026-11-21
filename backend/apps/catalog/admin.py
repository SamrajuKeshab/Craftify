from django.contrib import admin

from apps.catalog.models import (
    Category,
    Inventory,
    InventoryTransaction,
    Product,
    ProductImage,
    ProductVariant,
)


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "commission_rate", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "seller",
        "category",
        "base_price",
        "discount_price",
        "approval_status",
        "is_deleted",
    )
    list_filter = ("approval_status", "is_deleted", "category")
    search_fields = ("title", "slug", "seller__shop_name")


@admin.register(ProductImage)
class ProductImageAdmin(admin.ModelAdmin):
    list_display = ("product", "is_primary", "sort_order", "created_at")


@admin.register(ProductVariant)
class ProductVariantAdmin(admin.ModelAdmin):
    list_display = ("product", "label", "sku", "price_override", "is_active")
    search_fields = ("sku", "product__title")


@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ("variant", "quantity_available", "quantity_reserved", "updated_at")


@admin.register(InventoryTransaction)
class InventoryTransactionAdmin(admin.ModelAdmin):
    list_display = ("inventory", "change_type", "quantity_delta", "created_at")
    list_filter = ("change_type",)
