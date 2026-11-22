"""Django Admin registrations for Craftify Week 7 commerce models."""
from django.contrib import admin

from apps.commerce.models import (
    BuyerAddress,
    Cart,
    CartItem,
    Coupon,
    CouponUsage,
    Wishlist,
    WishlistItem,
)


@admin.register(BuyerAddress)
class BuyerAddressAdmin(admin.ModelAdmin):
    list_display = ("recipient_name", "user", "city", "state", "pincode", "is_default")
    list_filter = ("label", "is_default", "state")
    search_fields = ("recipient_name", "phone", "city", "pincode", "user__username")


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "discount_type",
        "value",
        "min_order_amount",
        "used_count",
        "max_uses",
        "is_active",
        "valid_until",
    )
    list_filter = ("discount_type", "is_active", "scope")
    search_fields = ("code", "description")


@admin.register(CouponUsage)
class CouponUsageAdmin(admin.ModelAdmin):
    list_display = ("coupon", "user", "discount_applied", "order_reference", "created_at")
    search_fields = ("coupon__code", "user__username", "order_reference")


@admin.register(Cart)
class CartAdmin(admin.ModelAdmin):
    list_display = ("user", "applied_coupon", "updated_at")
    search_fields = ("user__username",)


@admin.register(CartItem)
class CartItemAdmin(admin.ModelAdmin):
    list_display = ("cart", "variant", "quantity", "updated_at")


@admin.register(Wishlist)
class WishlistAdmin(admin.ModelAdmin):
    list_display = ("user", "updated_at")
    search_fields = ("user__username",)


@admin.register(WishlistItem)
class WishlistItemAdmin(admin.ModelAdmin):
    list_display = ("wishlist", "product", "created_at")
