from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import AuthActionToken, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = (
        "username",
        "full_name",
        "email",
        "role",
        "is_email_verified",
        "failed_login_attempts",
        "is_active",
        "created_at",
    )
    list_filter = ("role", "is_active", "is_email_verified")
    search_fields = ("username", "full_name", "email")
    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "Craftify Role & Security",
            {
                "fields": (
                    "full_name",
                    "role",
                    "is_email_verified",
                    "failed_login_attempts",
                    "locked_until",
                    "password_changed_at",
                )
            },
        ),
    )


@admin.register(AuthActionToken)
class AuthActionTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "purpose", "expires_at", "used_at", "created_at")
    list_filter = ("purpose",)
    search_fields = ("user__username", "user__email")
    readonly_fields = ("token_hash", "created_at")
