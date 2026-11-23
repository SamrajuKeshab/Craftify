"""URL routes for Week 9 Courier Dispatch, Tracking Events & 7-Day Returns."""
from django.urls import path

from apps.shipping.views import (
    AdminReturnListView,
    BuyerReturnListCreateView,
    CourierPresetsView,
    SellerReturnListView,
    SellerReturnResolveView,
    SellerSuborderDeliverView,
    SellerSuborderShipmentEventView,
    SellerSuborderShipView,
)

shipping_urlpatterns = [
    path("shipping/couriers/", CourierPresetsView.as_view(), name="shipping-couriers"),
    path(
        "seller/suborders/<uuid:suborder_id>/ship/",
        SellerSuborderShipView.as_view(),
        name="seller-suborder-ship",
    ),
    path(
        "seller/suborders/<uuid:suborder_id>/events/",
        SellerSuborderShipmentEventView.as_view(),
        name="seller-suborder-event",
    ),
    path(
        "seller/suborders/<uuid:suborder_id>/deliver/",
        SellerSuborderDeliverView.as_view(),
        name="seller-suborder-deliver",
    ),
    path(
        "buyer/returns/",
        BuyerReturnListCreateView.as_view(),
        name="buyer-returns",
    ),
    path(
        "seller/returns/",
        SellerReturnListView.as_view(),
        name="seller-returns-list",
    ),
    path(
        "seller/returns/<uuid:return_id>/resolve/",
        SellerReturnResolveView.as_view(),
        name="seller-return-resolve",
    ),
]

admin_shipping_urlpatterns = [
    path("returns/", AdminReturnListView.as_view(), name="admin-returns-list"),
]
