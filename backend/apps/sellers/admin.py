from django.contrib import admin

from apps.sellers.models import (
    SellerApplication,
    SellerProfile,
    SellerVerificationDocument,
)


@admin.register(SellerApplication)
class SellerApplicationAdmin(admin.ModelAdmin):
    list_display = ("shop_name", "user", "city", "state", "status", "created_at")
    list_filter = ("status", "state")
    search_fields = ("shop_name", "user__username", "user__email", "pan_number")


@admin.register(SellerVerificationDocument)
class SellerVerificationDocumentAdmin(admin.ModelAdmin):
    list_display = ("application", "doc_type", "original_filename", "verified_at", "created_at")
    list_filter = ("doc_type",)


@admin.register(SellerProfile)
class SellerProfileAdmin(admin.ModelAdmin):
    list_display = ("shop_name", "user", "city", "state", "is_suspended", "rating_avg")
    list_filter = ("is_suspended", "state")
    search_fields = ("shop_name", "slug", "user__username")
