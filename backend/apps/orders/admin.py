"""Django Admin registrations for Craftify Week 8 Orders & Payments models."""
from django.contrib import admin

from apps.orders.models import (
    Order,
    OrderItem,
    Payment,
    PaymentTransaction,
    SellerSuborder,
)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = (
        "order_number",
        "buyer",
        "total_amount",
        "payment_method",
        "payment_status",
        "overall_status",
        "created_at",
    )
    list_filter = ("payment_method", "payment_status", "overall_status")
    search_fields = ("order_number", "buyer__username", "coupon_code_snapshot")


@admin.register(SellerSuborder)
class SellerSuborderAdmin(admin.ModelAdmin):
    list_display = (
        "suborder_number",
        "seller_shop_name_snapshot",
        "subtotal_amount",
        "commission_amount",
        "net_seller_amount",
        "fulfilment_status",
        "created_at",
    )
    list_filter = ("fulfilment_status",)
    search_fields = ("suborder_number", "seller_shop_name_snapshot")


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = (
        "suborder",
        "product_title_snapshot",
        "variant_label_snapshot",
        "quantity",
        "unit_price_snapshot",
        "commission_rate_snapshot",
        "line_total",
    )


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = (
        "order",
        "provider",
        "amount",
        "status",
        "razorpay_order_id",
        "razorpay_payment_id",
        "created_at",
    )
    list_filter = ("provider", "status")
    search_fields = ("order__order_number", "razorpay_order_id", "razorpay_payment_id")


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ("payment", "event_type", "idempotency_key", "webhook_event_id", "created_at")
    list_filter = ("event_type",)
