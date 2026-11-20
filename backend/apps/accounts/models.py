"""Custom User model for Craftify with backend-authoritative roles."""
import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


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

    def __str__(self) -> str:
        return f"{self.username} ({self.role})"
