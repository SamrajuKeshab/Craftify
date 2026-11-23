"""Django admin registrations for Craftify Financial Ledger, Refunds & Seller Payouts."""
from django.contrib import admin

from apps.finance.models import LedgerEntry, RefundRecord, SellerPayout


@admin.register(LedgerEntry)
class LedgerEntryAdmin(admin.ModelAdmin):
    list_display = (
        "entry_type",
        "seller",
        "direction",
        "amount",
        "available_at",
        "hold_released_early",
        "created_at",
    )
    list_filter = ("entry_type", "direction", "hold_released_early")
    search_fields = ("seller__shop_name", "description", "idempotency_key")
    readonly_fields = ("id", "idempotency_key", "created_at", "updated_at")


@admin.register(RefundRecord)
class RefundRecordAdmin(admin.ModelAdmin):
    list_display = (
        "refund_number",
        "order",
        "buyer",
        "trigger_source",
        "amount",
        "status",
        "gateway_refund_id",
        "created_at",
    )
    list_filter = ("status", "trigger_source", "payment_method")
    search_fields = ("refund_number", "order__order_number", "gateway_refund_id")
    readonly_fields = ("id", "refund_number", "idempotency_key", "created_at", "updated_at")


@admin.register(SellerPayout)
class SellerPayoutAdmin(admin.ModelAdmin):
    list_display = (
        "payout_number",
        "seller",
        "amount",
        "bank_account_masked",
        "ifsc_code",
        "status",
        "utr_reference",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("payout_number", "seller__shop_name", "utr_reference")
    readonly_fields = ("id", "payout_number", "created_at", "updated_at")
