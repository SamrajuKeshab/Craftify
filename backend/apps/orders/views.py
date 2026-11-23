"""Week 8 REST API views for Multi-Vendor Checkout, Razorpay/COD Payments, and Order Management."""
import json
from datetime import datetime
from decimal import Decimal

from django.db.models import Q, Sum
from django.db.models.functions import TruncMonth
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.models import Order, Payment, SellerSuborder
from apps.orders.razorpay_client import (
    is_razorpay_configured,
    verify_razorpay_webhook_signature,
)
from apps.orders.serializers import (
    CheckoutRequestSerializer,
    OrderDetailSerializer,
    PaymentSummarySerializer,
    RazorpayFailSerializer,
    RazorpayVerifySerializer,
    SellerSuborderSerializer,
    SellerSuborderStatusUpdateSerializer,
)
from apps.orders.services import (
    cancel_buyer_order,
    create_checkout_order,
    finalize_razorpay_payment_capture,
    release_failed_razorpay_order,
    update_seller_suborder_status,
    verify_razorpay_payment_for_buyer,
)
from apps.sellers.models import SellerProfile
from common.permissions import IsAdminRole, IsApprovedSellerRole


# ---------------------------------------------------------------------------
# 1. Checkout & Payment Endpoints
# ---------------------------------------------------------------------------


class CheckoutConfigView(APIView):
    """GET /api/v1/checkout/config/ — Tells storefront whether Razorpay gateway is configured."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({"razorpay_configured": is_razorpay_configured()})


class CheckoutView(APIView):
    """POST /api/v1/checkout/ — Atomic stock lock + parent Order + split SellerSuborders."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order, razorpay_payload = create_checkout_order(
            user=request.user,
            address_id=serializer.validated_data["address_id"],
            payment_method=serializer.validated_data["payment_method"],
            idempotency_key=serializer.validated_data.get("idempotency_key") or None,
            request=request,
        )

        return Response(
            {
                "detail": (
                    f"Order {order.order_number} confirmed via Cash on Delivery."
                    if order.payment_method == Order.PaymentMethod.COD
                    else f"Order {order.order_number} created — complete Razorpay payment to confirm."
                ),
                "order": OrderDetailSerializer(order).data,
                "razorpay": razorpay_payload,
            },
            status=status.HTTP_201_CREATED,
        )


class RazorpayVerifyView(APIView):
    """POST /api/v1/payments/razorpay/verify/ — Server-side HMAC-SHA256 verification."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = RazorpayVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        order = verify_razorpay_payment_for_buyer(
            user=request.user,
            order_id=d["order_id"],
            razorpay_order_id=d["razorpay_order_id"],
            razorpay_payment_id=d["razorpay_payment_id"],
            razorpay_signature=d["razorpay_signature"],
            request=request,
        )

        return Response(
            {
                "detail": f"Payment verified! Order {order.order_number} is confirmed.",
                "order": OrderDetailSerializer(order).data,
            }
        )


class RazorpayFailView(APIView):
    """POST /api/v1/payments/razorpay/fail/ — Release reserved stock on cancelled/failed payment."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = RazorpayFailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        order = get_object_or_404(Order, pk=d["order_id"], buyer=request.user)
        payment = get_object_or_404(
            Payment, order=order, provider=Payment.Provider.RAZORPAY
        )
        updated = release_failed_razorpay_order(
            payment=payment,
            reason=d.get("reason") or "Payment cancelled by buyer",
            event_type="RAZORPAY_CHECKOUT_FAILED",
            idempotency_key=f"rzp-client-fail-{payment.id}",
        )
        return Response(
            {
                "detail": "Reserved stock released. Your cart is still intact so you can retry.",
                "order": OrderDetailSerializer(updated).data,
            }
        )


@method_decorator(csrf_exempt, name="dispatch")
class RazorpayWebhookView(APIView):
    """
    POST /api/v1/payments/razorpay/webhook/
    Razorpay-signed idempotent webhook listener for payment.captured and payment.failed.
    """

    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        raw_body = request.body
        signature = request.META.get("HTTP_X_RAZORPAY_SIGNATURE", "")
        if not verify_razorpay_webhook_signature(
            raw_body=raw_body, signature_header=signature
        ):
            return Response(
                {"detail": "Invalid Razorpay webhook signature."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return Response(
                {"detail": "Invalid JSON payload."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event = payload.get("event", "")
        event_id = (
            request.META.get("HTTP_X_RAZORPAY_EVENT_ID")
            or payload.get("id")
            or f"{event}-{payload.get('created_at', '')}"
        )
        payment_entity = (
            payload.get("payload", {}).get("payment", {}).get("entity", {})
        )
        rzp_order_id = payment_entity.get("order_id")
        rzp_payment_id = payment_entity.get("id")

        if not rzp_order_id:
            return Response({"status": "ignored"})

        payment = Payment.objects.filter(razorpay_order_id=rzp_order_id).first()
        if not payment:
            return Response({"status": "ignored"})

        redacted_payload = {
            "event": event,
            "razorpay_order_id": rzp_order_id,
            "razorpay_payment_id": rzp_payment_id,
            "status": payment_entity.get("status"),
            "method": payment_entity.get("method"),
            "amount": payment_entity.get("amount"),
        }

        if event == "payment.captured" and rzp_payment_id:
            finalize_razorpay_payment_capture(
                payment=payment,
                razorpay_payment_id=rzp_payment_id,
                event_type="WEBHOOK_PAYMENT_CAPTURED",
                idempotency_key=f"rzp-wh-cap-{event_id}",
                webhook_event_id=f"wh-{event_id}",
                raw_payload=redacted_payload,
            )
        elif event == "payment.failed":
            release_failed_razorpay_order(
                payment=payment,
                reason=payment_entity.get("error_description") or "Payment failed via webhook",
                event_type="WEBHOOK_PAYMENT_FAILED",
                idempotency_key=f"rzp-wh-fail-{event_id}",
                webhook_event_id=f"wh-{event_id}",
                raw_payload=redacted_payload,
            )

        return Response({"status": "ok"})


# ---------------------------------------------------------------------------
# 2. Buyer Order History & Cancellation (/api/v1/buyer/orders/*)
# ---------------------------------------------------------------------------


class BuyerOrderListView(APIView):
    """GET /api/v1/buyer/orders/ — Unified parent orders with nested per-studio suborders."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        orders = (
            Order.objects.filter(buyer=request.user)
            .exclude(overall_status=Order.OverallStatus.PENDING_PAYMENT)
            .select_related("buyer")
            .prefetch_related(
                "suborders__items__product",
                "suborders__seller",
                "suborders__shipment__events",
                "suborders__return_requests__order_item",
                "suborders__return_requests__buyer",
                "payments",
            )
            .order_by("-created_at")
        )
        data = OrderDetailSerializer(orders[:50], many=True).data
        return Response({"count": len(data), "results": data})


class BuyerOrderDetailView(APIView):
    """GET /api/v1/buyer/orders/<uuid:order_id>/ — Single buyer order detail."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, order_id):
        order = get_object_or_404(
            Order.objects.select_related("buyer").prefetch_related(
                "suborders__items__product",
                "suborders__seller",
                "suborders__shipment__events",
                "suborders__return_requests__order_item",
                "suborders__return_requests__buyer",
                "payments",
            ),
            pk=order_id,
            buyer=request.user,
        )
        return Response(OrderDetailSerializer(order).data)


class BuyerOrderCancelView(APIView):
    """POST /api/v1/buyer/orders/<uuid:order_id>/cancel/ — Cancel own order before packing."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, order_id):
        order = cancel_buyer_order(
            user=request.user, order_id=order_id, request=request
        )
        return Response(
            {
                "detail": f"Order {order.order_number} has been cancelled and stock restored.",
                "order": OrderDetailSerializer(order).data,
            }
        )


# ---------------------------------------------------------------------------
# 3. Seller Studio Suborders & Dashboard KPIs (/api/v1/seller/suborders/*)
# ---------------------------------------------------------------------------


def _build_6m_series(queryset, value_field: str, label_key: str) -> list[dict]:
    now = timezone.localdate()
    months = []
    year, month = now.year, now.month
    for _ in range(6):
        months.append((year, month))
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    months.reverse()

    start_year, start_month = months[0]
    start_dt = timezone.make_aware(
        datetime(start_year, start_month, 1, 0, 0, 0)
    )
    agg_rows = (
        queryset.filter(created_at__gte=start_dt)
        .annotate(month_dt=TruncMonth("created_at"))
        .values("month_dt")
        .annotate(total=Sum(value_field))
    )
    by_ym = {}
    for row in agg_rows:
        dt = row["month_dt"]
        if dt:
            by_ym[(dt.year, dt.month)] = float(row["total"] or Decimal("0.00"))

    month_names = [
        "",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ]
    return [
        {"month": month_names[m], label_key: round(by_ym.get((y, m), 0.0), 2)}
        for (y, m) in months
    ]


class SellerSuborderListView(APIView):
    """GET /api/v1/seller/suborders/ — Strictly this Seller's suborders + live KPI summary."""

    permission_classes = [IsApprovedSellerRole]

    def get(self, request):
        profile = get_object_or_404(SellerProfile, user=request.user)
        status_filter = (request.query_params.get("status") or "").strip().upper()

        base_qs = (
            SellerSuborder.objects.filter(seller=profile)
            .exclude(fulfilment_status=SellerSuborder.FulfilmentStatus.PENDING_PAYMENT)
            .select_related("parent_order", "parent_order__buyer", "seller", "shipment")
            .prefetch_related(
                "items__product",
                "shipment__events",
                "return_requests__order_item",
                "return_requests__buyer",
            )
            .order_by("-created_at")
        )

        # Live Seller KPIs excluding cancelled/returned orders
        active_sales_qs = base_qs.exclude(
            fulfilment_status__in=[
                SellerSuborder.FulfilmentStatus.CANCELLED,
                SellerSuborder.FulfilmentStatus.RETURNED,
            ]
        )
        totals = active_sales_qs.aggregate(
            gross=Sum("subtotal_amount"),
            commission=Sum("commission_amount"),
            net=Sum("net_seller_amount"),
        )
        sales_series = _build_6m_series(active_sales_qs, "subtotal_amount", "sales")

        filtered_qs = base_qs
        if status_filter and status_filter != "ALL":
            filtered_qs = filtered_qs.filter(fulfilment_status=status_filter)

        data = SellerSuborderSerializer(filtered_qs[:100], many=True).data
        return Response(
            {
                "count": len(data),
                "summary": {
                    "total_sales": f"{(totals['gross'] or Decimal('0.00')):.2f}",
                    "total_commission": f"{(totals['commission'] or Decimal('0.00')):.2f}",
                    "net_earnings": f"{(totals['net'] or Decimal('0.00')):.2f}",
                    "total_orders": active_sales_qs.count(),
                    "pending_count": base_qs.filter(
                        fulfilment_status=SellerSuborder.FulfilmentStatus.PENDING
                    ).count(),
                },
                "sales_series": sales_series,
                "results": data,
            }
        )


class SellerSuborderStatusUpdateView(APIView):
    """PATCH /api/v1/seller/suborders/<uuid:suborder_id>/status/ — Accept, Pack, or Cancel."""

    permission_classes = [IsApprovedSellerRole]

    def patch(self, request, suborder_id):
        profile = get_object_or_404(SellerProfile, user=request.user)
        serializer = SellerSuborderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = update_seller_suborder_status(
            seller_profile=profile,
            suborder_id=suborder_id,
            new_status=serializer.validated_data["status"],
            seller_notes=serializer.validated_data.get("seller_notes", ""),
            request=request,
        )
        return Response(
            {
                "detail": f"Suborder {updated.suborder_number} marked as {updated.fulfilment_status}.",
                "suborder": SellerSuborderSerializer(updated).data,
            }
        )


# ---------------------------------------------------------------------------
# 4. Admin Orders & Payments Oversight (/api/v1/admin/orders/, /admin/payments/)
# ---------------------------------------------------------------------------


class AdminOrderListView(APIView):
    """GET /api/v1/admin/orders/ — Platform-wide multi-vendor order governance."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        status_filter = (request.query_params.get("status") or "").strip().upper()
        search = (request.query_params.get("search") or "").strip()

        qs = (
            Order.objects.select_related("buyer")
            .prefetch_related(
                "suborders__items__product",
                "suborders__seller",
                "suborders__shipment__events",
                "suborders__return_requests__order_item",
                "suborders__return_requests__buyer",
                "payments",
            )
            .order_by("-created_at")
        )
        if status_filter and status_filter != "ALL":
            qs = qs.filter(overall_status=status_filter)
        if search:
            qs = qs.filter(
                Q(order_number__icontains=search)
                | Q(buyer__username__icontains=search)
                | Q(buyer__full_name__icontains=search)
                | Q(suborders__seller_shop_name_snapshot__icontains=search)
            ).distinct()

        data = OrderDetailSerializer(qs[:100], many=True).data
        return Response({"count": len(data), "results": data})


class AdminPaymentListView(APIView):
    """GET /api/v1/admin/payments/ — Platform-wide Razorpay & COD payment ledger."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        provider_filter = (request.query_params.get("provider") or "").strip().upper()
        search = (request.query_params.get("search") or "").strip()

        qs = Payment.objects.select_related("order", "order__buyer").order_by(
            "-created_at"
        )
        if provider_filter in (Payment.Provider.RAZORPAY, Payment.Provider.COD):
            qs = qs.filter(provider=provider_filter)
        if search:
            qs = qs.filter(
                Q(order__order_number__icontains=search)
                | Q(razorpay_order_id__icontains=search)
                | Q(razorpay_payment_id__icontains=search)
                | Q(order__buyer__username__icontains=search)
            )

        data = PaymentSummarySerializer(qs[:100], many=True).data
        return Response({"count": len(data), "results": data})
