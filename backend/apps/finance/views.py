"""API views for Seller Earnings/Payouts, Buyer Refunds, and Admin Financial Governance."""
from django.db.models import Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.finance.models import LedgerEntry, RefundRecord, SellerPayout
from apps.finance.serializers import (
    AdminPayoutActionSerializer,
    AdminRefundActionSerializer,
    AdminReleaseHoldSerializer,
    LedgerEntrySerializer,
    RefundRecordSerializer,
    SellerPayoutRequestSerializer,
    SellerPayoutSerializer,
)
from apps.finance.services import (
    compute_platform_finance_summary,
    compute_seller_balance,
    process_admin_payout,
    process_admin_refund,
    release_ledger_hold_early,
    request_seller_payout,
)
from apps.sellers.models import SellerProfile
from common.permissions import IsAdminRole, IsApprovedSellerRole


def _get_seller_profile_or_404(user):
    return SellerProfile.objects.filter(user=user).select_related("user").first()


def _serialize_balance(balance: dict) -> dict:
    return {
        "currency": balance["currency"],
        "settlement_hold_days": balance["settlement_hold_days"],
        "total_net_earned": f"{balance['total_net_earned']:.2f}",
        "total_commission_paid": f"{balance['total_commission_paid']:.2f}",
        "total_refund_debits": f"{balance['total_refund_debits']:.2f}",
        "pending_settlement": f"{balance['pending_settlement']:.2f}",
        "available_balance": f"{balance['available_balance']:.2f}",
        "in_flight_payouts": f"{balance['in_flight_payouts']:.2f}",
        "total_paid_out": f"{balance['total_paid_out']:.2f}",
        "bank_account_masked": balance["bank_account_masked"],
        "ifsc_code": balance["ifsc_code"],
        "has_payout_bank_details": balance["has_payout_bank_details"],
    }


# ---------------------------------------------------------------------------
# Seller Endpoints (/api/v1/seller/finance/*) — Strictly IsApprovedSellerRole
# ---------------------------------------------------------------------------


class SellerFinanceOverviewView(APIView):
    """GET /api/v1/seller/finance/ — Live INR balance summary, ledger & payout history."""

    permission_classes = [IsApprovedSellerRole]

    def get(self, request):
        profile = _get_seller_profile_or_404(request.user)
        if profile is None:
            return Response(
                {"detail": "Seller studio profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        entry_type = (request.query_params.get("entry_type") or "").strip().upper()
        ledger_qs = LedgerEntry.objects.filter(seller=profile).select_related(
            "seller", "suborder", "return_request", "refund", "payout"
        )
        if entry_type in LedgerEntry.EntryType.values:
            ledger_qs = ledger_qs.filter(entry_type=entry_type)

        payouts_qs = SellerPayout.objects.filter(seller=profile).select_related(
            "seller", "seller__user", "processed_by"
        )

        balance = compute_seller_balance(profile)
        return Response(
            {
                "summary": _serialize_balance(balance),
                "payouts": SellerPayoutSerializer(payouts_qs[:50], many=True).data,
                "ledger": LedgerEntrySerializer(ledger_qs[:100], many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class SellerPayoutRequestView(APIView):
    """POST /api/v1/seller/finance/payouts/ — Request withdrawal from available INR balance."""

    permission_classes = [IsApprovedSellerRole]

    def post(self, request):
        profile = _get_seller_profile_or_404(request.user)
        if profile is None:
            return Response(
                {"detail": "Seller studio profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = SellerPayoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payout = request_seller_payout(
            seller_profile=profile,
            amount=serializer.validated_data["amount"],
            seller_notes=serializer.validated_data.get("seller_notes", ""),
            request=request,
        )
        balance = compute_seller_balance(profile)
        return Response(
            {
                "detail": (
                    f"Payout request {payout.payout_number} for ₹{payout.amount} submitted "
                    f"to {payout.bank_account_masked} ({payout.ifsc_code})."
                ),
                "payout": SellerPayoutSerializer(payout).data,
                "summary": _serialize_balance(balance),
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Buyer Endpoint (/api/v1/buyer/refunds/) — Authenticated Buyer's own refunds
# ---------------------------------------------------------------------------


class BuyerRefundListView(APIView):
    """GET /api/v1/buyer/refunds/ — List the signed-in buyer's own refund records."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = RefundRecord.objects.filter(buyer=request.user).select_related(
            "order", "suborder", "return_request", "buyer", "processed_by"
        )
        return Response(
            {
                "count": qs.count(),
                "results": RefundRecordSerializer(qs[:50], many=True).data,
            },
            status=status.HTTP_200_OK,
        )


# ---------------------------------------------------------------------------
# Admin Governance Endpoints (/api/v1/admin/finance/*) — Strictly IsAdminRole
# ---------------------------------------------------------------------------


class AdminFinanceOverviewView(APIView):
    """GET /api/v1/admin/finance/ — Live platform commission, payout, refund & ledger queues."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        payout_status = (request.query_params.get("payout_status") or "").strip().upper()
        refund_status = (request.query_params.get("refund_status") or "").strip().upper()
        entry_type = (request.query_params.get("entry_type") or "").strip().upper()
        search = (request.query_params.get("search") or "").strip()

        payouts_qs = SellerPayout.objects.select_related(
            "seller", "seller__user", "processed_by"
        ).all()
        if payout_status in SellerPayout.Status.values:
            payouts_qs = payouts_qs.filter(status=payout_status)
        if search:
            payouts_qs = payouts_qs.filter(
                Q(payout_number__icontains=search)
                | Q(seller__shop_name__icontains=search)
                | Q(utr_reference__icontains=search)
            )

        refunds_qs = RefundRecord.objects.select_related(
            "order", "suborder", "return_request", "buyer", "processed_by"
        ).all()
        if refund_status in RefundRecord.Status.values:
            refunds_qs = refunds_qs.filter(status=refund_status)
        if search:
            refunds_qs = refunds_qs.filter(
                Q(refund_number__icontains=search)
                | Q(order__order_number__icontains=search)
                | Q(buyer__username__icontains=search)
                | Q(gateway_refund_id__icontains=search)
            )

        ledger_qs = LedgerEntry.objects.select_related(
            "seller", "suborder", "return_request", "refund", "payout"
        ).all()
        if entry_type in LedgerEntry.EntryType.values:
            ledger_qs = ledger_qs.filter(entry_type=entry_type)
        if search:
            ledger_qs = ledger_qs.filter(
                Q(seller__shop_name__icontains=search)
                | Q(description__icontains=search)
                | Q(suborder__suborder_number__icontains=search)
            )

        return Response(
            {
                "summary": compute_platform_finance_summary(),
                "payouts": SellerPayoutSerializer(payouts_qs[:100], many=True).data,
                "refunds": RefundRecordSerializer(refunds_qs[:100], many=True).data,
                "ledger": LedgerEntrySerializer(ledger_qs[:120], many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminPayoutActionView(APIView):
    """POST /api/v1/admin/finance/payouts/<uuid:pk>/action/ — Mark PROCESSING, PAID, or REJECTED."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        serializer = AdminPayoutActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payout = process_admin_payout(
            admin_user=request.user,
            payout_id=pk,
            new_status=serializer.validated_data["status"],
            utr_reference=serializer.validated_data.get("utr_reference", ""),
            admin_notes=serializer.validated_data.get("admin_notes", ""),
            request=request,
        )
        return Response(
            {
                "detail": f"Payout {payout.payout_number} marked as {payout.get_status_display()}.",
                "payout": SellerPayoutSerializer(payout).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminRefundActionView(APIView):
    """POST /api/v1/admin/finance/refunds/<uuid:pk>/action/ — Mark PROCESSED or FAILED."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        serializer = AdminRefundActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        refund = process_admin_refund(
            admin_user=request.user,
            refund_id=pk,
            new_status=serializer.validated_data["status"],
            gateway_refund_id=serializer.validated_data.get("gateway_refund_id", ""),
            admin_notes=serializer.validated_data.get("admin_notes", ""),
            request=request,
        )
        return Response(
            {
                "detail": f"Refund {refund.refund_number} marked as {refund.get_status_display()}.",
                "refund": RefundRecordSerializer(refund).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminReleaseHoldView(APIView):
    """POST /api/v1/admin/finance/ledger/<uuid:pk>/release-hold/ — Release 7-day hold early."""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        serializer = AdminReleaseHoldSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        entry = release_ledger_hold_early(
            admin_user=request.user,
            entry_id=pk,
            reason=serializer.validated_data.get("reason", ""),
            request=request,
        )
        return Response(
            {
                "detail": (
                    f"Released ₹{entry.amount} hold early for {entry.seller.shop_name}. "
                    "Funds are now available for payout."
                ),
                "entry": LedgerEntrySerializer(entry).data,
            },
            status=status.HTTP_200_OK,
        )


class SellerAnalyticsView(APIView):
    """GET /api/v1/seller/analytics/ — Real PostgreSQL studio analytics & top crafts."""

    permission_classes = [IsApprovedSellerRole]

    def get(self, request):
        from apps.finance.analytics import compute_seller_studio_analytics

        profile = _get_seller_profile_or_404(request.user)
        if profile is None:
            return Response(
                {"detail": "Seller studio profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            compute_seller_studio_analytics(profile),
            status=status.HTTP_200_OK,
        )


class AdminAnalyticsView(APIView):
    """GET /api/v1/admin/analytics/ — Real PostgreSQL marketplace analytics & charts."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        from apps.finance.analytics import compute_admin_platform_analytics

        return Response(
            compute_admin_platform_analytics(),
            status=status.HTTP_200_OK,
        )
