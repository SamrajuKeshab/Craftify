"""DRF serializers for Week 8 Multi-Vendor Checkout, Orders, Suborders, and Payments."""
from rest_framework import serializers

from apps.orders.models import Order, OrderItem, Payment, SellerSuborder


class CheckoutRequestSerializer(serializers.Serializer):
    address_id = serializers.UUIDField()
    payment_method = serializers.ChoiceField(choices=Order.PaymentMethod.choices)
    idempotency_key = serializers.CharField(
        required=False, allow_blank=True, max_length=80, default=""
    )


class RazorpayVerifySerializer(serializers.Serializer):
    order_id = serializers.UUIDField()
    razorpay_order_id = serializers.CharField(max_length=80)
    razorpay_payment_id = serializers.CharField(max_length=80)
    razorpay_signature = serializers.CharField(max_length=256)


class RazorpayFailSerializer(serializers.Serializer):
    order_id = serializers.UUIDField()
    reason = serializers.CharField(
        required=False, allow_blank=True, max_length=255, default="Payment cancelled"
    )


class SellerSuborderStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            SellerSuborder.FulfilmentStatus.ACCEPTED,
            SellerSuborder.FulfilmentStatus.PACKED,
            SellerSuborder.FulfilmentStatus.CANCELLED,
        ]
    )
    seller_notes = serializers.CharField(
        required=False, allow_blank=True, max_length=300, default=""
    )


class OrderItemSerializer(serializers.ModelSerializer):
    is_return_restricted = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = (
            "id",
            "product_id",
            "variant_id",
            "product_title_snapshot",
            "product_slug_snapshot",
            "product_image_snapshot",
            "variant_label_snapshot",
            "variant_sku_snapshot",
            "unit_price_snapshot",
            "commission_rate_snapshot",
            "quantity",
            "line_total",
            "customization_note",
            "is_return_restricted",
        )
        read_only_fields = fields

    def get_is_return_restricted(self, obj):
        from apps.shipping.services import is_order_item_restricted_return

        return is_order_item_restricted_return(obj)


class SellerSuborderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    parent_order_number = serializers.CharField(
        source="parent_order.order_number", read_only=True
    )
    payment_method = serializers.CharField(
        source="parent_order.payment_method", read_only=True
    )
    payment_status = serializers.CharField(
        source="parent_order.payment_status", read_only=True
    )
    buyer_name = serializers.CharField(
        source="parent_order.buyer.full_name", read_only=True
    )
    buyer_username = serializers.CharField(
        source="parent_order.buyer.username", read_only=True
    )
    shipping_address_snapshot = serializers.JSONField(
        source="parent_order.shipping_address_snapshot", read_only=True
    )
    seller_slug = serializers.CharField(source="seller.slug", read_only=True)
    shipment = serializers.SerializerMethodField()
    return_requests = serializers.SerializerMethodField()
    return_window_ends_at = serializers.SerializerMethodField()
    is_return_eligible = serializers.SerializerMethodField()

    class Meta:
        model = SellerSuborder
        fields = (
            "id",
            "suborder_number",
            "parent_order_number",
            "seller_id",
            "seller_slug",
            "seller_shop_name_snapshot",
            "buyer_name",
            "buyer_username",
            "shipping_address_snapshot",
            "payment_method",
            "payment_status",
            "subtotal_amount",
            "discount_share",
            "shipping_share",
            "commission_amount",
            "net_seller_amount",
            "fulfilment_status",
            "seller_notes",
            "delivered_at",
            "return_window_ends_at",
            "is_return_eligible",
            "shipment",
            "return_requests",
            "items",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_shipment(self, obj):
        from apps.shipping.serializers import ShipmentSerializer

        shipment = getattr(obj, "shipment", None)
        if shipment is None:
            return None
        return ShipmentSerializer(shipment).data

    def get_return_requests(self, obj):
        from apps.shipping.serializers import ReturnRequestSerializer

        returns_rel = getattr(obj, "return_requests", None)
        if returns_rel is None:
            return []
        return ReturnRequestSerializer(returns_rel.all(), many=True).data

    def get_return_window_ends_at(self, obj):
        from apps.shipping.services import get_suborder_return_window_info

        ends_at, _ = get_suborder_return_window_info(obj)
        return ends_at.isoformat() if ends_at else None

    def get_is_return_eligible(self, obj):
        from apps.shipping.services import get_suborder_return_window_info

        _, eligible = get_suborder_return_window_info(obj)
        return eligible


class PaymentSummarySerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    buyer_username = serializers.CharField(source="order.buyer.username", read_only=True)
    buyer_full_name = serializers.CharField(source="order.buyer.full_name", read_only=True)

    class Meta:
        model = Payment
        fields = (
            "id",
            "order_id",
            "order_number",
            "buyer_username",
            "buyer_full_name",
            "provider",
            "razorpay_order_id",
            "razorpay_payment_id",
            "amount",
            "currency",
            "status",
            "failure_reason",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class OrderDetailSerializer(serializers.ModelSerializer):
    buyer_username = serializers.CharField(source="buyer.username", read_only=True)
    buyer_full_name = serializers.CharField(source="buyer.full_name", read_only=True)
    buyer_email = serializers.EmailField(source="buyer.email", read_only=True)
    suborders = SellerSuborderSerializer(many=True, read_only=True)
    payments = PaymentSummarySerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = (
            "id",
            "order_number",
            "buyer_username",
            "buyer_full_name",
            "buyer_email",
            "shipping_address_snapshot",
            "coupon_code_snapshot",
            "currency",
            "subtotal_amount",
            "discount_amount",
            "shipping_amount",
            "total_amount",
            "payment_method",
            "payment_status",
            "overall_status",
            "suborders",
            "payments",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields
