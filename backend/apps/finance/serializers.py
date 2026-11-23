"""Serializers for Craftify Financial Ledger, Refunds & Seller Payouts."""
from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.finance.models import LedgerEntry, RefundRecord, SellerPayout


class LedgerEntrySerializer(serializers.ModelSerializer):
    seller_shop_name = serializers.CharField(source="seller.shop_name", read_only=True)
    suborder_number = serializers.SerializerMethodField()
    return_number = serializers.SerializerMethodField()
    refund_number = serializers.SerializerMethodField()
    payout_number = serializers.SerializerMethodField()
    settlement_state = serializers.SerializerMethodField()

    class Meta:
        model = LedgerEntry
        fields = [
            "id",
            "seller_shop_name",
            "suborder_number",
            "return_number",
            "refund_number",
            "payout_number",
            "entry_type",
            "direction",
            "amount",
            "available_at",
            "hold_released_early",
            "settlement_state",
            "description",
            "metadata",
            "created_at",
        ]

    def get_suborder_number(self, obj) -> str:
        return obj.suborder.suborder_number if obj.suborder_id else ""

    def get_return_number(self, obj) -> str:
        return obj.return_request.return_number if obj.return_request_id else ""

    def get_refund_number(self, obj) -> str:
        return obj.refund.refund_number if obj.refund_id else ""

    def get_payout_number(self, obj) -> str:
        return obj.payout.payout_number if obj.payout_id else ""

    def get_settlement_state(self, obj) -> str:
        if obj.entry_type != LedgerEntry.EntryType.SALE_CREDIT:
            return "POSTED"
        if obj.available_at and obj.available_at > timezone.now():
            return "HOLD"
        return "AVAILABLE"


class SellerPayoutSerializer(serializers.ModelSerializer):
    seller_shop_name = serializers.CharField(source="seller.shop_name", read_only=True)
    seller_username = serializers.CharField(source="seller.user.username", read_only=True)
    processed_by_username = serializers.SerializerMethodField()

    class Meta:
        model = SellerPayout
        fields = [
            "id",
            "payout_number",
            "seller_shop_name",
            "seller_username",
            "amount",
            "bank_account_masked",
            "ifsc_code",
            "status",
            "utr_reference",
            "seller_notes",
            "admin_notes",
            "processed_by_username",
            "processed_at",
            "created_at",
            "updated_at",
        ]

    def get_processed_by_username(self, obj) -> str:
        return obj.processed_by.username if obj.processed_by_id else ""


class SellerPayoutRequestSerializer(serializers.Serializer):
    amount = serializers.DecimalField(
        max_digits=12,
        decimal_places=2,
        min_value=Decimal("1.00"),
    )
    seller_notes = serializers.CharField(
        required=False, allow_blank=True, max_length=300, default=""
    )


class AdminPayoutActionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            SellerPayout.Status.PROCESSING,
            SellerPayout.Status.PAID,
            SellerPayout.Status.REJECTED,
        ]
    )
    utr_reference = serializers.CharField(
        required=False, allow_blank=True, max_length=80, default=""
    )
    admin_notes = serializers.CharField(
        required=False, allow_blank=True, max_length=400, default=""
    )


class RefundRecordSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    suborder_number = serializers.SerializerMethodField()
    return_number = serializers.SerializerMethodField()
    buyer_username = serializers.CharField(source="buyer.username", read_only=True)
    buyer_email = serializers.CharField(source="buyer.email", read_only=True)
    processed_by_username = serializers.SerializerMethodField()

    class Meta:
        model = RefundRecord
        fields = [
            "id",
            "refund_number",
            "order_number",
            "suborder_number",
            "return_number",
            "buyer_username",
            "buyer_email",
            "payment_method",
            "trigger_source",
            "amount",
            "commission_reversed",
            "net_seller_deduction",
            "status",
            "gateway_refund_id",
            "admin_notes",
            "processed_by_username",
            "processed_at",
            "created_at",
            "updated_at",
        ]

    def get_suborder_number(self, obj) -> str:
        return obj.suborder.suborder_number if obj.suborder_id else ""

    def get_return_number(self, obj) -> str:
        return obj.return_request.return_number if obj.return_request_id else ""

    def get_processed_by_username(self, obj) -> str:
        return obj.processed_by.username if obj.processed_by_id else ""


class AdminRefundActionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[
            RefundRecord.Status.PROCESSED,
            RefundRecord.Status.FAILED,
        ]
    )
    gateway_refund_id = serializers.CharField(
        required=False, allow_blank=True, max_length=100, default=""
    )
    admin_notes = serializers.CharField(
        required=False, allow_blank=True, max_length=400, default=""
    )


class AdminReleaseHoldSerializer(serializers.Serializer):
    reason = serializers.CharField(
        required=False, allow_blank=True, max_length=240, default=""
    )
