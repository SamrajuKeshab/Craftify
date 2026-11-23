"""Services for creating and marking persistent in-app Notifications."""
from django.utils import timezone

from apps.notifications.models import Notification


def create_notification(
    *,
    recipient,
    category: str,
    title: str,
    message: str,
    action_url: str = "",
    metadata: dict | None = None,
) -> Notification | None:
    """Safely persist an in-app notification for a single authenticated user."""
    if recipient is None:
        return None
    return Notification.objects.create(
        recipient=recipient,
        category=category,
        title=(title or "").strip()[:160],
        message=(message or "").strip()[:400],
        action_url=(action_url or "").strip()[:255],
        metadata=metadata or {},
    )


def mark_notification_read(*, user, notification_id) -> Notification | None:
    """Mark one notification as read strictly if owned by the requesting user."""
    notif = Notification.objects.filter(pk=notification_id, recipient=user).first()
    if notif is None:
        return None
    if not notif.is_read:
        notif.is_read = True
        notif.read_at = timezone.now()
        notif.save(update_fields=["is_read", "read_at", "updated_at"])
    return notif


def mark_all_notifications_read(*, user) -> int:
    """Mark every unread notification for the requesting user as read."""
    return Notification.objects.filter(recipient=user, is_read=False).update(
        is_read=True,
        read_at=timezone.now(),
    )
