"""DRF serializers for Week 9 Courier Shipments, Tracking Events & 7-Day Returns."""
from rest_framework import serializers

from apps.shipping.models import ReturnRequest, Shipment, ShipmentEvent


class ShipmentEventSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = ShipmentEvent
        fields = (
            "id",
            "status",
            "status_label",
            "location",
            "notes",
            "event_timestamp",
        )
        read_only_fields = fields


class ShipmentSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(
        source="get_current_status_display", read_only=True
    )
    events = ShipmentEventSerializer(many=True, read_only=True)

    class Meta:
        model = Shipment
        fields = (
            "id",
            "courier_name",
            "tracking_number",
            "tracking_url",
            "current_status",
            "status_label",
            "shipped_at",
            "estimated_delivery_date",
            "delivered_at",
            "dispatch_notes",
            "events",
        )
        read_only_fields = fields


class ReturnRequestSerializer(serializers.ModelSerializer):
    reason_label = serializers.CharField(source="get_reason_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    suborder_number = serializers.CharField(
        source="suborder.suborder_number", read_only=True
    )
    parent_order_number = serializers.CharField(
        source="suborder.parent_order.order_number", read_only=True
    )
    seller_shop_name = serializers.CharField(
        source="suborder.seller_shop_name_snapshot", read_only=True
    )
    buyer_name = serializers.CharField(source="buyer.full_name", read_only=True)
    buyer_username = serializers.CharField(source="buyer.username", read_only=True)
    product_title = serializers.CharField(
        source="order_item.product_title_snapshot", read_only=True
    )
    product_image = serializers.CharField(
        source="order_item.product_image_snapshot", read_only=True
    )
    variant_label = serializers.CharField(
        source="order_item.variant_label_snapshot", read_only=True
    )
    customization_note = serializers.CharField(
        source="order_item.customization_note", read_only=True
    )

    class Meta:
        model = ReturnRequest
        fields = (
            "id",
            "return_number",
            "suborder_id",
            "suborder_number",
            "parent_order_number",
            "order_item_id",
            "seller_shop_name",
            "buyer_name",
            "buyer_username",
            "product_title",
            "product_image",
            "variant_label",
            "customization_note",
            "reason",
            "reason_label",
            "description",
            "evidence_urls",
            "quantity",
            "refund_amount",
            "status",
            "status_label",
            "seller_response_note",
            "restocked",
            "resolved_at",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class DispatchShipmentSerializer(serializers.Serializer):
    courier_name = serializers.CharField(max_length=80)
    tracking_number = serializers.CharField(max_length=100)
    tracking_url = serializers.CharField(
        required=False, allow_blank=True, max_length=500, default=""
    )
    estimated_delivery_date = serializers.DateField(required=False, allow_null=True)
    dispatch_notes = serializers.CharField(
        required=False, allow_blank=True, max_length=300, default=""
    )


class AddShipmentEventSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            Shipment.Status.IN_TRANSIT,
            Shipment.Status.OUT_FOR_DELIVERY,
            Shipment.Status.DELIVERY_ATTEMPTED,
        ]
    )
    location = serializers.CharField(
        required=False, allow_blank=True, max_length=120, default=""
    )
    notes = serializers.CharField(
        required=False, allow_blank=True, max_length=300, default=""
    )


class DeliverSuborderSerializer(serializers.Serializer):
    delivery_notes = serializers.CharField(
        required=False, allow_blank=True, max_length=300, default=""
    )


class CreateReturnRequestSerializer(serializers.Serializer):
    order_item_id = serializers.UUIDField()
    reason = serializers.ChoiceField(choices=ReturnRequest.Reason.choices)
    description = serializers.CharField(max_length=1000)
    quantity = serializers.IntegerField(min_value=1, required=False, default=1)


class ResolveReturnRequestSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            ReturnRequest.Status.APPROVED,
            ReturnRequest.Status.REJECTED,
            ReturnRequest.Status.PICKED_UP,
            ReturnRequest.Status.COMPLETED,
        ]
    )
    seller_response_note = serializers.CharField(
        required=False, allow_blank=True, max_length=400, default=""
    )
    restock_inventory = serializers.BooleanField(required=False, default=False)
