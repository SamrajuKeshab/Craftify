from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "full_name", "email", "role", "is_active", "created_at")
    list_filter = ("role", "is_active", "is_email_verified")
    search_fields = ("username", "full_name", "email")
    fieldsets = BaseUserAdmin.fieldsets + (
        ("Craftify Role & Profile", {"fields": ("full_name", "role", "is_email_verified")}),
    )
