"""URL routes for Week 8 Checkout, Razorpay/COD Payments, Buyer Orders, Seller Suborders & Admin Orders."""
from django.urls import path

from apps.orders.views import (
    AdminOrderListView,
    AdminPaymentListView,
    BuyerOrderCancelView,
    BuyerOrderDetailView,
    BuyerOrderListView,
    CheckoutConfigView,
    CheckoutView,
    RazorpayFailView,
    RazorpayVerifyView,
    RazorpayWebhookView,
    SellerSuborderListView,
    SellerSuborderStatusUpdateView,
)

orders_urlpatterns = [
    path("checkout/config/", CheckoutConfigView.as_view(), name="checkout-config"),
    path("checkout/", CheckoutView.as_view(), name="checkout-create"),
    path(
        "payments/razorpay/verify/",
        RazorpayVerifyView.as_view(),
        name="razorpay-verify",
    ),
    path(
        "payments/razorpay/fail/",
        RazorpayFailView.as_view(),
        name="razorpay-fail",
    ),
    path(
        "payments/razorpay/webhook/",
        RazorpayWebhookView.as_view(),
        name="razorpay-webhook",
    ),
    path("buyer/orders/", BuyerOrderListView.as_view(), name="buyer-orders-list"),
    path(
        "buyer/orders/<uuid:order_id>/",
        BuyerOrderDetailView.as_view(),
        name="buyer-order-detail",
    ),
    path(
        "buyer/orders/<uuid:order_id>/cancel/",
        BuyerOrderCancelView.as_view(),
        name="buyer-order-cancel",
    ),
    path(
        "seller/suborders/",
        SellerSuborderListView.as_view(),
        name="seller-suborders-list",
    ),
    path(
        "seller/suborders/<uuid:suborder_id>/status/",
        SellerSuborderStatusUpdateView.as_view(),
        name="seller-suborder-status",
    ),
]

admin_orders_urlpatterns = [
    path("orders/", AdminOrderListView.as_view(), name="admin-orders-list"),
    path("payments/", AdminPaymentListView.as_view(), name="admin-payments-list"),
]
