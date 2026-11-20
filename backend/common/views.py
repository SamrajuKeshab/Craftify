"""System health check view for verifying Django + PostgreSQL connectivity."""
from django.conf import settings
from django.db import connection
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    """Returns API & database status so the React frontend can verify local connectivity."""

    permission_classes = [AllowAny]

    def get(self, request):
        db_ok = True
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except Exception:
            db_ok = False

        payload = {
            "status": "ok" if db_ok else "degraded",
            "service": "craftify-django-api",
            "version": "v1",
            "currency": settings.CRAFTIFY_CURRENCY,
            "database": "connected" if db_ok else "unavailable",
        }
        return Response(
            payload,
            status=status.HTTP_200_OK if db_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
        )
