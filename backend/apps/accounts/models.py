"""Custom User and hashed AuthActionToken models for Craftify authentication."""
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """
    Craftify User model.
    - Public sign-ups ALWAYS create BUYER accounts.
    - SELLER role is assigned only after Admin approves a SellerApplication.
    - ADMIN accounts are created strictly via `manage.py create_initial_admin`.
    """

    class Role(models.TextChoices):
        ADMIN = "ADMIN", "Admin"
        SELLER = "SELLER", "Seller"
        BUYER = "BUYER", "Buyer"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    role = models.CharField(
        max_length=16,
        choices=Role.choices,
        default=Role.BUYER,
        db_index=True,
    )
    is_email_verified = models.BooleanField(default=False)
    failed_login_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    password_changed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    REQUIRED_FIELDS = ["email", "full_name"]

    class Meta:
        db_table = "users"
        indexes = [
            models.Index(fields=["role", "is_active"]),
        ]

    def get_dashboard_redirect_url(self) -> str:
        """Authoritative post-login dashboard route resolved strictly from DB role."""
        mapping = {
            self.Role.ADMIN: "/admin/dashboard",
            self.Role.SELLER: "/seller/dashboard",
            self.Role.BUYER: "/buyer/dashboard",
        }
        return mapping.get(self.role, "/buyer/dashboard")

    def is_locked(self) -> bool:
        """Returns True if the account is currently in a temporary brute-force lockout."""
        return bool(self.locked_until and self.locked_until > timezone.now())

    def register_failed_login(self) -> None:
        """Increment failed login counter and apply temporary lockout at threshold."""
        threshold = getattr(settings, "AUTH_LOCKOUT_THRESHOLD", 5)
        lockout_minutes = getattr(settings, "AUTH_LOCKOUT_MINUTES", 15)
        self.failed_login_attempts = (self.failed_login_attempts or 0) + 1
        if self.failed_login_attempts >= threshold:
            self.locked_until = timezone.now() + timedelta(minutes=lockout_minutes)
        self.save(update_fields=["failed_login_attempts", "locked_until", "updated_at"])

    def clear_failed_logins(self) -> None:
        """Reset lockout state after successful authentication or password reset."""
        if self.failed_login_attempts or self.locked_until:
            self.failed_login_attempts = 0
            self.locked_until = None
            self.save(update_fields=["failed_login_attempts", "locked_until", "updated_at"])

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"


class AuthActionToken(models.Model):
    """
    Single-use, expiring token for email verification and password reset.
    Only the SHA-256 hash of the raw token is stored in PostgreSQL so raw tokens
    can never be recovered from database backups or read leaks.
    """

    class Purpose(models.TextChoices):
        EMAIL_VERIFY = "EMAIL_VERIFY", "Email Verification"
        PASSWORD_RESET = "PASSWORD_RESET", "Password Reset"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="auth_action_tokens",
    )
    purpose = models.CharField(max_length=24, choices=Purpose.choices, db_index=True)
    token_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "auth_action_tokens"
        indexes = [
            models.Index(fields=["user", "purpose", "used_at"]),
        ]

    @property
    def is_valid(self) -> bool:
        return self.used_at is None and self.expires_at > timezone.now()

    def __str__(self) -> str:
        return f"{self.purpose} for {self.user.username}"
