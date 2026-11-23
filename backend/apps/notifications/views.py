"""DRF serializers, views, and URL routes for In-App Notifications."""
from django.urls import path
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.models import Notification
from apps.notifications.services import (
    mark_all_notifications_read,
    mark_notification_read,
)


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "category",
            "title",
            "message",
            "action_url",
            "is_read",
            "read_at",
            "metadata",
            "created_at",
        ]


class NotificationListView(APIView):
    """GET /api/v1/notifications/ — List current user's notifications & unread count."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        unread_only = (request.query_params.get("unread") or "").lower() == "true"
        base_qs = Notification.objects.filter(recipient=request.user)
        unread_count = base_qs.filter(is_read=False).count()
        qs = base_qs.filter(is_read=False) if unread_only else base_qs
        return Response(
            {
                "unread_count": unread_count,
                "results": NotificationSerializer(qs[:40], many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class NotificationMarkReadView(APIView):
    """POST /api/v1/notifications/<uuid:notification_id>/read/"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, notification_id):
        notif = mark_notification_read(
            user=request.user, notification_id=notification_id
        )
        if notif is None:
            return Response(
                {"detail": "Notification not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        unread_count = Notification.objects.filter(
            recipient=request.user, is_read=False
        ).count()
        return Response(
            {
                "unread_count": unread_count,
                "notification": NotificationSerializer(notif).data,
            },
            status=status.HTTP_200_OK,
        )


class NotificationMarkAllReadView(APIView):
    """POST /api/v1/notifications/read-all/"""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        updated = mark_all_notifications_read(user=request.user)
        return Response(
            {
                "detail": f"Marked {updated} notification(s) as read.",
                "unread_count": 0,
            },
            status=status.HTTP_200_OK,
        )


notifications_urlpatterns = [
    path(
        "notifications/",
        NotificationListView.as_view(),
        name="notifications-list",
    ),
    path(
        "notifications/read-all/",
        NotificationMarkAllReadView.as_view(),
        name="notifications-read-all",
    ),
    path(
        "notifications/<uuid:notification_id>/read/",
        NotificationMarkReadView.as_view(),
        name="notifications-mark-read",
    ),
]
