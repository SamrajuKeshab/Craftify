"""URL routing for Seller Onboarding (/api/v1/sellers/) and Admin Panel (/api/v1/admin/)."""
from django.urls import path

from apps.sellers.views import (
    AdminAuditLogListView,
    AdminBuyerListView,
    AdminDashboardSummaryView,
    AdminSellerApplicationListView,
    AdminSellerApplicationReviewView,
    AdminSellerListView,
    AdminSellerSuspendToggleView,
    AdminUserActiveToggleView,
    MySellerApplicationStatusView,
    SellerApplicationCreateView,
    SellerShopProfileView,
    VerificationDocumentDownloadView,
)

seller_urlpatterns = [
    path("apply/", SellerApplicationCreateView.as_view(), name="seller-apply"),
    path(
        "application-status/",
        MySellerApplicationStatusView.as_view(),
        name="seller-application-status",
    ),
    path("shop/", SellerShopProfileView.as_view(), name="seller-shop-profile"),
    path(
        "documents/<uuid:pk>/",
        VerificationDocumentDownloadView.as_view(),
        name="seller-doc-download",
    ),
]

admin_urlpatterns = [
    path("dashboard/", AdminDashboardSummaryView.as_view(), name="admin-dashboard"),
    path(
        "seller-applications/",
        AdminSellerApplicationListView.as_view(),
        name="admin-seller-applications",
    ),
    path(
        "seller-applications/<uuid:pk>/review/",
        AdminSellerApplicationReviewView.as_view(),
        name="admin-seller-application-review",
    ),
    path("sellers/", AdminSellerListView.as_view(), name="admin-sellers-list"),
    path(
        "sellers/<uuid:pk>/toggle-suspend/",
        AdminSellerSuspendToggleView.as_view(),
        name="admin-seller-toggle-suspend",
    ),
    path("buyers/", AdminBuyerListView.as_view(), name="admin-buyers-list"),
    path(
        "users/<uuid:pk>/toggle-active/",
        AdminUserActiveToggleView.as_view(),
        name="admin-user-toggle-active",
    ),
    path("audit-logs/", AdminAuditLogListView.as_view(), name="admin-audit-logs"),
]
