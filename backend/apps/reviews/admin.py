"""Django admin registration for Verified Product Reviews."""
from django.contrib import admin

from apps.reviews.models import ProductReview


@admin.register(ProductReview)
class ProductReviewAdmin(admin.ModelAdmin):
    list_display = ("product", "seller", "buyer", "rating", "status", "created_at")
    list_filter = ("status", "rating")
    search_fields = ("product__title", "seller__shop_name", "buyer__username", "comment")
    readonly_fields = ("id", "created_at", "updated_at")
