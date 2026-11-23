from django.contrib import admin

from apps.shipping.models import ReturnRequest, Shipment, ShipmentEvent


class ShipmentEventInline(admin.TabularInline):
    model = ShipmentEvent
    extra = 0
    readonly_fields = ("status", "location", "notes", "event_timestamp")


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = (
        "suborder",
        "courier_name",
        "tracking_number",
        "current_status",
        "shipped_at",
        "delivered_at",
    )
    list_filter = ("current_status", "courier_name")
    search_fields = ("tracking_number", "suborder__suborder_number")
    inlines = [ShipmentEventInline]


@admin.register(ReturnRequest)
class ReturnRequestAdmin(admin.ModelAdmin):
    list_display = (
        "return_number",
        "suborder",
        "buyer",
        "reason",
        "refund_amount",
        "status",
        "restocked",
        "created_at",
    )
    list_filter = ("status", "reason", "restocked")
    search_fields = ("return_number", "suborder__suborder_number", "buyer__username")
