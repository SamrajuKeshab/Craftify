"""URL routing for Week 7 Buyer Addresses, Cart, Wishlist, and Admin Coupons."""
from django.urls import path

from apps.commerce.views import (
    AdminCouponDetailView,
    AdminCouponListCreateView,
    BuyerAddressDetailView,
    BuyerAddressListCreateView,
    BuyerAddressSetDefaultView,
    CartApplyCouponView,
    CartItemAddView,
    CartItemDetailView,
    CartRemoveCouponView,
    CartView,
    CouponValidateView,
    WishlistItemDeleteView,
    WishlistMoveToCartView,
    WishlistToggleView,
    WishlistView,
)

commerce_urlpatterns = [
    # Buyer Indian Delivery Address Book
    path(
        "buyer/addresses/",
        BuyerAddressListCreateView.as_view(),
        name="buyer-address-list-create",
    ),
    path(
        "buyer/addresses/<uuid:address_id>/",
        BuyerAddressDetailView.as_view(),
        name="buyer-address-detail",
    ),
    path(
        "buyer/addresses/<uuid:address_id>/set-default/",
        BuyerAddressSetDefaultView.as_view(),
        name="buyer-address-set-default",
    ),
    # Persistent Shopping Cart & Coupon Application
    path("cart/", CartView.as_view(), name="cart-detail"),
    path("cart/items/", CartItemAddView.as_view(), name="cart-item-add"),
    path("cart/items/<uuid:item_id>/", CartItemDetailView.as_view(), name="cart-item-detail"),
    path("cart/apply-coupon/", CartApplyCouponView.as_view(), name="cart-apply-coupon"),
    path("cart/coupon/", CartRemoveCouponView.as_view(), name="cart-remove-coupon"),
    path("coupons/validate/", CouponValidateView.as_view(), name="coupon-validate"),
    # Persistent Wishlist
    path("wishlist/", WishlistView.as_view(), name="wishlist-detail"),
    path("wishlist/toggle/", WishlistToggleView.as_view(), name="wishlist-toggle"),
    path(
        "wishlist/<uuid:product_id>/",
        WishlistItemDeleteView.as_view(),
        name="wishlist-item-delete",
    ),
    path(
        "wishlist/<uuid:product_id>/move-to-cart/",
        WishlistMoveToCartView.as_view(),
        name="wishlist-move-to-cart",
    ),
]

admin_commerce_urlpatterns = [
    path("coupons/", AdminCouponListCreateView.as_view(), name="admin-coupon-list-create"),
    path(
        "coupons/<uuid:coupon_id>/",
        AdminCouponDetailView.as_view(),
        name="admin-coupon-detail",
    ),
]
