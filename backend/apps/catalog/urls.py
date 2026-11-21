"""URL patterns for Public Catalog, Seller Products, and Admin Categories/Moderation."""
from django.urls import path

from apps.catalog.views import (
    AdminCategoryDetailView,
    AdminCategoryListCreateView,
    AdminProductListView,
    AdminProductModerateView,
    PublicCategoryListView,
    PublicProductDetailView,
    PublicProductListView,
    PublicShopDetailView,
    PublicShopListView,
    SellerProductDetailView,
    SellerProductImageDetailView,
    SellerProductImageUploadView,
    SellerProductListCreateView,
)

public_catalog_urlpatterns = [
    path("categories/", PublicCategoryListView.as_view(), name="public-categories"),
    path("products/", PublicProductListView.as_view(), name="public-products"),
    path("products/<slug:slug>/", PublicProductDetailView.as_view(), name="public-product-detail"),
    path("shops/", PublicShopListView.as_view(), name="public-shops"),
    path("shops/<slug:slug>/", PublicShopDetailView.as_view(), name="public-shop-detail"),
]

seller_product_urlpatterns = [
    path("", SellerProductListCreateView.as_view(), name="seller-products"),
    path("<uuid:pk>/", SellerProductDetailView.as_view(), name="seller-product-detail"),
    path(
        "<uuid:pk>/images/",
        SellerProductImageUploadView.as_view(),
        name="seller-product-images",
    ),
    path(
        "<uuid:product_id>/images/<uuid:image_id>/",
        SellerProductImageDetailView.as_view(),
        name="seller-product-image-detail",
    ),
]

admin_catalog_urlpatterns = [
    path("categories/", AdminCategoryListCreateView.as_view(), name="admin-categories"),
    path(
        "categories/<uuid:pk>/",
        AdminCategoryDetailView.as_view(),
        name="admin-category-detail",
    ),
    path("products/", AdminProductListView.as_view(), name="admin-products"),
    path(
        "products/<uuid:pk>/moderate/",
        AdminProductModerateView.as_view(),
        name="admin-product-moderate",
    ),
]
