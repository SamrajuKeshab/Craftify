"""API views for Seller Onboarding, Shop Management, and Admin Governance."""
import mimetypes
import os
import re

from django.conf import settings
from django.db.models import Q
from django.http import Http404, HttpResponse
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.sellers.models import (
    SellerApplication,
    SellerProfile,
    SellerVerificationDocument,
)
from apps.sellers.serializers import (
    AdminAuditLogSerializer,
    AdminBuyerListSerializer,
    SellerApplicationCreateSerializer,
    SellerApplicationReviewSerializer,
    SellerApplicationSerializer,
    SellerProfileSerializer,
    SellerShopUpdateSerializer,
)
from apps.sellers.services import (
    review_seller_application,
    submit_seller_application,
    toggle_seller_suspension,
    toggle_user_active_status,
)
from common.permissions import IsAdminRole, IsApprovedSellerRole


class SellerApplicationCreateView(APIView):
    """POST /api/v1/sellers/apply/ — Verified BUYER submits a SellerApplication."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    throttle_scope = "seller_apply"

    def post(self, request):
        serializer = SellerApplicationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = submit_seller_application(
            user=request.user,
            validated_data=serializer.validated_data,
            request=request,
        )
        return Response(
            {
                "detail": "Your seller application has been submitted for Admin review.",
                "application": SellerApplicationSerializer(application).data,
            },
            status=status.HTTP_201_CREATED,
        )


class MySellerApplicationStatusView(APIView):
    """GET /api/v1/sellers/application-status/ — Inspect current user's latest application & shop."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        latest_app = (
            SellerApplication.objects.filter(user=request.user)
            .prefetch_related("documents")
            .select_related("reviewed_by", "user")
            .first()
        )
        profile = SellerProfile.objects.filter(user=request.user).select_related("user").first()
        return Response(
            {
                "role": request.user.role,
                "is_email_verified": request.user.is_email_verified,
                "application": SellerApplicationSerializer(latest_app).data
                if latest_app
                else None,
                "seller_profile": SellerProfileSerializer(profile).data
                if profile
                else None,
            },
            status=status.HTTP_200_OK,
        )


class SellerShopProfileView(APIView):
    """GET/PATCH /api/v1/sellers/shop/ — Approved SELLER manages their own studio profile."""

    permission_classes = [IsApprovedSellerRole]

    def get(self, request):
        profile = SellerProfile.objects.filter(user=request.user).select_related("user").first()
        if profile is None:
            return Response(
                {"detail": "Seller studio profile not found for this account."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(SellerProfileSerializer(profile).data, status=status.HTTP_200_OK)

    def patch(self, request):
        profile = SellerProfile.objects.filter(user=request.user).select_related("user").first()
        if profile is None:
            return Response(
                {"detail": "Seller studio profile not found for this account."},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = SellerShopUpdateSerializer(profile, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        return Response(SellerProfileSerializer(updated).data, status=status.HTTP_200_OK)


class VerificationDocumentDownloadView(APIView):
    """
    GET /api/v1/sellers/documents/<uuid:pk>/
    Restricted strictly to Admin users or the applicant who uploaded the file.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        doc = (
            SellerVerificationDocument.objects.select_related("application")
            .filter(id=pk)
            .first()
        )
        if doc is None:
            raise Http404("Verification document not found.")

        is_admin = request.user.role == User.Role.ADMIN
        is_owner = doc.application.user_id == request.user.id
        if not (is_admin or is_owner):
            return Response(
                {"detail": "You do not have permission to access this verification document."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not doc.file:
            raise Http404("File missing.")

        media_root = os.path.realpath(str(settings.MEDIA_ROOT))
        resolved_path = os.path.realpath(doc.file.path)
        if not resolved_path.startswith(media_root + os.sep) or not os.path.isfile(resolved_path):
            raise Http404("Document file not available.")

        raw_name = os.path.basename(doc.original_filename or os.path.basename(resolved_path))
        safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", raw_name) or "document"
        content_type, _ = mimetypes.guess_type(safe_name)
        with open(resolved_path, "rb") as file_handle:
            file_bytes = file_handle.read()

        response = HttpResponse(
            file_bytes,
            content_type=content_type or "application/octet-stream",
        )
        response["Content-Disposition"] = f'attachment; filename="{safe_name}"'
        response["X-Content-Type-Options"] = "nosniff"
        return response


# ---------------------------------------------------------------------------
# Admin Panel Endpoints (/api/v1/admin/*) — Strictly IsAdminRole
# ---------------------------------------------------------------------------


class AdminDashboardSummaryView(APIView):
    """GET /api/v1/admin/dashboard/ — Live PostgreSQL counts for Admin Dashboard."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        total_buyers = User.objects.filter(role=User.Role.BUYER).count()
        total_sellers = SellerProfile.objects.count()
        active_sellers = SellerProfile.objects.filter(is_suspended=False).count()
        pending_seller_apps = SellerApplication.objects.filter(
            status=SellerApplication.Status.PENDING
        ).count()
        recent_logs = AuditLog.objects.select_related("actor")[:8]

        return Response(
            {
                "kpis": {
                    "total_revenue": "0.00",
                    "total_orders": 0,
                    "total_buyers": total_buyers,
                    "total_sellers": total_sellers,
                    "active_sellers": active_sellers,
                },
                "pending_approvals": {
                    "seller_applications": pending_seller_apps,
                    "product_approvals": 0,
                },
                "recent_audit_logs": AdminAuditLogSerializer(recent_logs, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminSellerApplicationListView(APIView):
    """GET /api/v1/admin/seller-applications/?status=PENDING&search=..."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = (
            SellerApplication.objects.select_related("user", "reviewed_by")
            .prefetch_related("documents")
            .all()
        )
        status_filter = (request.query_params.get("status") or "").strip().upper()
        if status_filter in {
            SellerApplication.Status.PENDING,
            SellerApplication.Status.APPROVED,
            SellerApplication.Status.REJECTED,
        }:
            qs = qs.filter(status=status_filter)

        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(shop_name__icontains=search)
                | Q(user__username__icontains=search)
                | Q(user__email__icontains=search)
                | Q(city__icontains=search)
            )

        return Response(
            {
                "count": qs.count(),
                "results": SellerApplicationSerializer(qs[:100], many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminSellerApplicationReviewView(APIView):
    """POST /api/v1/admin/seller-applications/<uuid:pk>/review/"""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        serializer = SellerApplicationReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = review_seller_application(
            admin_user=request.user,
            application_id=pk,
            action=serializer.validated_data["action"],
            review_notes=serializer.validated_data.get("review_notes", ""),
            request=request,
        )
        return Response(
            {
                "detail": (
                    f"Application approved — @{application.user.username} is now a Craftify Seller."
                    if application.status == SellerApplication.Status.APPROVED
                    else f"Application for '{application.shop_name}' has been rejected."
                ),
                "application": SellerApplicationSerializer(application).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminSellerListView(APIView):
    """GET /api/v1/admin/sellers/?search=..."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = SellerProfile.objects.select_related("user").all()
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(shop_name__icontains=search)
                | Q(user__username__icontains=search)
                | Q(user__email__icontains=search)
                | Q(city__icontains=search)
            )
        return Response(
            {
                "count": qs.count(),
                "results": SellerProfileSerializer(qs[:100], many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminSellerSuspendToggleView(APIView):
    """POST /api/v1/admin/sellers/<uuid:pk>/toggle-suspend/"""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        reason = request.data.get("reason", "")
        profile = toggle_seller_suspension(
            admin_user=request.user,
            seller_profile_id=pk,
            reason=reason,
            request=request,
        )
        return Response(
            {
                "detail": (
                    f"Seller studio '{profile.shop_name}' suspended."
                    if profile.is_suspended
                    else f"Seller studio '{profile.shop_name}' reinstated."
                ),
                "seller": SellerProfileSerializer(profile).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminBuyerListView(APIView):
    """GET /api/v1/admin/buyers/?search=..."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = (
            User.objects.filter(role=User.Role.BUYER)
            .prefetch_related("seller_applications")
            .order_by("-created_at")
        )
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(username__icontains=search)
                | Q(full_name__icontains=search)
                | Q(email__icontains=search)
            )
        return Response(
            {
                "count": qs.count(),
                "results": AdminBuyerListSerializer(qs[:100], many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminUserActiveToggleView(APIView):
    """POST /api/v1/admin/users/<uuid:pk>/toggle-active/"""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        reason = request.data.get("reason", "")
        target = toggle_user_active_status(
            admin_user=request.user,
            target_user_id=pk,
            reason=reason,
            request=request,
        )
        return Response(
            {
                "detail": (
                    f"Account @{target.username} activated."
                    if target.is_active
                    else f"Account @{target.username} suspended and active sessions revoked."
                ),
                "user": AdminBuyerListSerializer(target).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminAuditLogListView(APIView):
    """GET /api/v1/admin/audit-logs/ — Read-only immutable security & governance trail."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = AuditLog.objects.select_related("actor").all()
        return Response(
            {
                "count": qs.count(),
                "results": AdminAuditLogSerializer(qs[:100], many=True).data,
            },
            status=status.HTTP_200_OK,
        )
