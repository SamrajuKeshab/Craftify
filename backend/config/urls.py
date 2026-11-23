"""Root URL routing for Craftify API (/api/v1/)."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.catalog.urls import (
    admin_catalog_urlpatterns,
    public_catalog_urlpatterns,
    seller_product_urlpatterns,
)
from apps.commerce.urls import (
    admin_commerce_urlpatterns,
    commerce_urlpatterns,
)
from apps.orders.urls import (
    admin_orders_urlpatterns,
    orders_urlpatterns,
)
from apps.shipping.urls import (
    admin_shipping_urlpatterns,
    shipping_urlpatterns,
)
from apps.sellers.urls import admin_urlpatterns, seller_urlpatterns
from common.views import HealthCheckView

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/health/", HealthCheckView.as_view(), name="api-health"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/sellers/", include(seller_urlpatterns)),
    path("api/v1/seller/products/", include(seller_product_urlpatterns)),
    path("api/v1/admin/", include(admin_urlpatterns)),
    path("api/v1/admin/", include(admin_catalog_urlpatterns)),
    path("api/v1/admin/", include(admin_commerce_urlpatterns)),
    path("api/v1/admin/", include(admin_orders_urlpatterns)),
    path("api/v1/admin/", include(admin_shipping_urlpatterns)),
    path("api/v1/", include(shipping_urlpatterns)),
    path("api/v1/", include(orders_urlpatterns)),
    path("api/v1/", include(commerce_urlpatterns)),
    path("api/v1/", include(public_catalog_urlpatterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
