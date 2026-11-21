from django.contrib import admin

from apps.audit.models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "actor", "target_model", "target_id", "created_at")
    list_filter = ("action", "target_model")
    search_fields = ("summary", "target_id", "actor__username")
    readonly_fields = (
        "id",
        "actor",
        "action",
        "target_model",
        "target_id",
        "summary",
        "metadata_json",
        "ip_address",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
