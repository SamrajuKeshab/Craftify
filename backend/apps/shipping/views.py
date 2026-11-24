"""Week 9 REST API views for Indian Courier Dispatch, Tracking Events & 7-Day Returns."""
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.orders.serializers import SellerSuborderSerializer
from apps.sellers.models import SellerProfile
from apps.shipping.models import ReturnRequest
from apps.shipping.serializers import (
    AddShipmentEventSerializer,
    CreateReturnRequestSerializer,
    DeliverSuborderSerializer,
    DispatchShipmentSerializer,
    ResolveReturnRequestSerializer,
    ReturnRequestSerializer,
)
from apps.shipping.services import (
    INDIAN_COURIERS,
    add_shipment_tracking_event,
    create_buyer_return_request,
    dispatch_seller_suborder,
    mark_suborder_delivered,
    resolve_seller_return_request,
)
from common.permissions import IsAdminRole, IsApprovedSellerRole


class SellerSuborderShipView(APIView):
    """POST /api/v1/seller/suborders/<uuid:suborder_id>/ship/ — Dispatch packed parcel with courier."""

    permission_classes = [IsApprovedSellerRole]

    def post(self, request, suborder_id):
        profile = get_object_or_404(SellerProfile, user=request.user)
        serializer = DispatchShipmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        updated = dispatch_seller_suborder(
            seller_profile=profile,
            suborder_id=suborder_id,
            courier_name=d["courier_name"],
            tracking_number=d["tracking_number"],
            tracking_url=d.get("tracking_url", ""),
            estimated_delivery_date=d.get("estimated_delivery_date"),
            dispatch_notes=d.get("dispatch_notes", ""),
            request=request,
        )
        return Response(
            {
                "detail": (
                    f"Suborder {updated.suborder_number} marked as SHIPPED via "
                    f"{updated.shipment.courier_name} ({updated.shipment.tracking_number})."
                ),
                "suborder": SellerSuborderSerializer(updated).data,
            },
            status=status.HTTP_201_CREATED,
        )


class SellerSuborderShipmentEventView(APIView):
    """POST /api/v1/seller/suborders/<uuid:suborder_id>/events/ — Add transit checkpoint."""

    permission_classes = [IsApprovedSellerRole]

    def post(self, request, suborder_id):
        profile = get_object_or_404(SellerProfile, user=request.user)
        serializer = AddShipmentEventSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        updated = add_shipment_tracking_event(
            seller_profile=profile,
            suborder_id=suborder_id,
            status=d["status"],
            location=d.get("location", ""),
            notes=d.get("notes", ""),
            request=request,
        )
        return Response(
            {
                "detail": f"Tracking update ({d['status']}) recorded for {updated.suborder_number}.",
                "suborder": SellerSuborderSerializer(updated).data,
            },
            status=status.HTTP_201_CREATED,
        )


class SellerSuborderDeliverView(APIView):
    """POST /api/v1/seller/suborders/<uuid:suborder_id>/deliver/ — Mark parcel delivered."""

    permission_classes = [IsApprovedSellerRole]

    def post(self, request, suborder_id):
        profile = get_object_or_404(SellerProfile, user=request.user)
        serializer = DeliverSuborderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        updated = mark_suborder_delivered(
            seller_profile=profile,
            suborder_id=suborder_id,
            delivery_notes=serializer.validated_data.get("delivery_notes", ""),
            request=request,
        )
        return Response(
            {
                "detail": f"Suborder {updated.suborder_number} marked as DELIVERED. 7-day return window started.",
                "suborder": SellerSuborderSerializer(updated).data,
            }
        )


class CourierPresetsView(APIView):
    """GET /api/v1/shipping/couriers/ — Standard Indian courier choices for seller dispatch."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({"couriers": INDIAN_COURIERS})


class BuyerReturnListCreateView(APIView):
    """
    GET  /api/v1/buyer/returns/ — List authenticated buyer's own return requests.
    POST /api/v1/buyer/returns/ — Submit 7-day return request with optional Cloudinary proof photos.
    """

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_throttles(self):
        if self.request.method == "POST":
            self.throttle_scope = "return_request"
        else:
            self.throttle_scope = None
        return super().get_throttles()

    def get(self, request):
        qs = (
            ReturnRequest.objects.filter(buyer=request.user)
            .select_related("suborder", "suborder__parent_order", "order_item", "buyer")
            .order_by("-created_at")
        )
        data = ReturnRequestSerializer(qs[:50], many=True).data
        return Response({"count": len(data), "results": data})

    def post(self, request):
        serializer = CreateReturnRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        evidence_files = request.FILES.getlist("evidence_images")

        ret = create_buyer_return_request(
            buyer=request.user,
            order_item_id=d["order_item_id"],
            reason=d["reason"],
            description=d["description"],
            quantity=d.get("quantity", 1),
            evidence_files=evidence_files,
            request=request,
        )
        return Response(
            {
                "detail": (
                    f"Return request {ret.return_number} submitted to "
                    f"{ret.suborder.seller_shop_name_snapshot}."
                ),
                "return_request": ReturnRequestSerializer(ret).data,
            },
            status=status.HTTP_201_CREATED,
        )


class SellerReturnListView(APIView):
    """GET /api/v1/seller/returns/ — Strictly this studio's incoming 7-day return requests."""

    permission_classes = [IsApprovedSellerRole]

    def get(self, request):
        profile = get_object_or_404(SellerProfile, user=request.user)
        status_filter = (request.query_params.get("status") or "").strip().upper()

        base_qs = (
            ReturnRequest.objects.filter(suborder__seller=profile)
            .select_related("suborder", "suborder__parent_order", "order_item", "buyer")
            .order_by("-created_at")
        )
        pending_count = base_qs.filter(status=ReturnRequest.Status.REQUESTED).count()

        filtered = base_qs
        if status_filter and status_filter != "ALL":
            filtered = filtered.filter(status=status_filter)

        data = ReturnRequestSerializer(filtered[:100], many=True).data
        return Response(
            {
                "count": len(data),
                "pending_count": pending_count,
                "results": data,
            }
        )


class SellerReturnResolveView(APIView):
    """PATCH /api/v1/seller/returns/<uuid:return_id>/resolve/ — Seller approves/rejects/completes return."""

    permission_classes = [IsApprovedSellerRole]

    def patch(self, request, return_id):
        profile = get_object_or_404(SellerProfile, user=request.user)
        serializer = ResolveReturnRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        updated = resolve_seller_return_request(
            seller_profile=profile,
            return_id=return_id,
            new_status=d["status"],
            seller_response_note=d.get("seller_response_note", ""),
            restock_inventory=d.get("restock_inventory", False),
            request=request,
        )
        return Response(
            {
                "detail": f"Return {updated.return_number} updated to {updated.get_status_display()}.",
                "return_request": ReturnRequestSerializer(updated).data,
            }
        )


class AdminReturnListView(APIView):
    """GET /api/v1/admin/returns/ — Read-only platform-wide return request governance."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        status_filter = (request.query_params.get("status") or "").strip().upper()
        search = (request.query_params.get("search") or "").strip()

        qs = ReturnRequest.objects.select_related(
            "suborder", "suborder__parent_order", "order_item", "buyer"
        ).order_by("-created_at")
        if status_filter and status_filter != "ALL":
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(
                Q(return_number__icontains=search)
                | Q(suborder__suborder_number__icontains=search)
                | Q(suborder__seller_shop_name_snapshot__icontains=search)
                | Q(buyer__username__icontains=search)
            )
        data = ReturnRequestSerializer(qs[:100], many=True).data
        return Response({"count": len(data), "results": data})
