"""URL routes for Seller Earnings/Payouts, Buyer Refunds, and Admin Finance Governance."""
from django.urls import path

from apps.finance.views import (
    AdminFinanceOverviewView,
    AdminPayoutActionView,
    AdminRefundActionView,
    AdminReleaseHoldView,
    BuyerRefundListView,
    SellerFinanceOverviewView,
    SellerPayoutRequestView,
)

finance_urlpatterns = [
    path(
        "seller/finance/",
        SellerFinanceOverviewView.as_view(),
        name="seller-finance-overview",
    ),
    path(
        "seller/finance/payouts/",
        SellerPayoutRequestView.as_view(),
        name="seller-payout-request",
    ),
    path(
        "buyer/refunds/",
        BuyerRefundListView.as_view(),
        name="buyer-refund-list",
    ),
]

admin_finance_urlpatterns = [
    path(
        "finance/",
        AdminFinanceOverviewView.as_view(),
        name="admin-finance-overview",
    ),
    path(
        "finance/payouts/<uuid:pk>/action/",
        AdminPayoutActionView.as_view(),
        name="admin-payout-action",
    ),
    path(
        "finance/refunds/<uuid:pk>/action/",
        AdminRefundActionView.as_view(),
        name="admin-refund-action",
    ),
    path(
        "finance/ledger/<uuid:pk>/release-hold/",
        AdminReleaseHoldView.as_view(),
        name="admin-release-hold",
    ),
]
