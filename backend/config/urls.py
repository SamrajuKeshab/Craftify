"""Root URL routing for Craftify API (/api/v1/)."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.sellers.urls import admin_urlpatterns, seller_urlpatterns
from common.views import HealthCheckView

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/health/", HealthCheckView.as_view(), name="api-health"),
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/sellers/", include(seller_urlpatterns)),
    path("api/v1/admin/", include(admin_urlpatterns)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
