"""Root URL routing for Craftify API (/api/v1/)."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from common.views import HealthCheckView

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/health/", HealthCheckView.as_view(), name="api-health"),
    path("api/v1/auth/", include("apps.accounts.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
