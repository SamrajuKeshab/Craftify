"""Django admin registration for Notifications."""
from django.contrib import admin

from apps.notifications.models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("category", "title", "recipient", "is_read", "created_at")
    list_filter = ("category", "is_read")
    search_fields = ("title", "message", "recipient__username")
    readonly_fields = ("id", "created_at", "updated_at")
