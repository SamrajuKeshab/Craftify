"""Business-logic services for Craftify authentication, tokens, emails, and cookies."""
import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .models import AuthActionToken, User

logger = logging.getLogger(__name__)


def hash_token(raw_token: str) -> str:
    """Return SHA-256 hex digest for safe database storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


@transaction.atomic
def create_action_token(user: User, purpose: str) -> str:
    """
    Invalidate any prior unused tokens for the same user & purpose,
    then issue a fresh cryptographically random single-use token.
    """
    now = timezone.now()
    AuthActionToken.objects.filter(
        user=user,
        purpose=purpose,
        used_at__isnull=True,
    ).update(used_at=now)

    raw_token = secrets.token_urlsafe(32)
    if purpose == AuthActionToken.Purpose.EMAIL_VERIFY:
        expiry = now + timedelta(
            hours=getattr(settings, "AUTH_EMAIL_VERIFY_EXPIRY_HOURS", 24)
        )
    else:
        expiry = now + timedelta(
            minutes=getattr(settings, "AUTH_PASSWORD_RESET_EXPIRY_MINUTES", 30)
        )

    AuthActionToken.objects.create(
        user=user,
        purpose=purpose,
        token_hash=hash_token(raw_token),
        expires_at=expiry,
    )
    return raw_token


@transaction.atomic
def consume_action_token(raw_token: str, purpose: str):
    """
    Validate and atomically mark a single-use token as consumed.
    Returns the owning User or None if invalid/expired/already used.
    """
    if not raw_token or not isinstance(raw_token, str):
        return None

    token_obj = (
        AuthActionToken.objects.select_for_update()
        .select_related("user")
        .filter(
            token_hash=hash_token(raw_token.strip()),
            purpose=purpose,
            used_at__isnull=True,
            expires_at__gt=timezone.now(),
        )
        .first()
    )
    if not token_obj or not token_obj.user.is_active:
        return None

    token_obj.used_at = timezone.now()
    token_obj.save(update_fields=["used_at"])
    return token_obj.user


def send_verification_email(user: User) -> str:
    """Generate a verification token and dispatch the verification email."""
    raw_token = create_action_token(user, AuthActionToken.Purpose.EMAIL_VERIFY)
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={raw_token}"

    subject = "Verify your Craftify email address"
    message = (
        f"Hello {user.full_name},\n\n"
        f"Welcome to Craftify! Please verify your email address using the link below "
        f"(valid for 24 hours):\n\n"
        f"{verify_url}\n\n"
        f"If you did not create a Craftify account, you can safely ignore this email."
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
    logger.info("Dispatched email verification link for user_id=%s", user.id)
    return raw_token


def send_password_reset_email(user: User) -> str:
    """Generate a single-use password reset token and dispatch reset instructions."""
    raw_token = create_action_token(user, AuthActionToken.Purpose.PASSWORD_RESET)
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={raw_token}"

    subject = "Reset your Craftify password"
    message = (
        f"Hello {user.full_name},\n\n"
        f"We received a request to reset your Craftify password. Use the single-use link "
        f"below within 30 minutes:\n\n"
        f"{reset_url}\n\n"
        f"If you did not request a password reset, no changes have been made to your account."
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )
    logger.info("Dispatched password reset link for user_id=%s", user.id)
    return raw_token


def revoke_all_user_tokens(user: User) -> int:
    """Blacklist every active refresh token belonging to `user` across all devices."""
    outstanding = OutstandingToken.objects.filter(user=user)
    count = 0
    for token in outstanding:
        _, created = BlacklistedToken.objects.get_or_create(token=token)
        if created:
            count += 1
    return count


def set_refresh_cookie(response, refresh_token: str) -> None:
    """Store rotating refresh token in an HttpOnly cookie (never exposed to JS)."""
    cookie_name = getattr(settings, "AUTH_REFRESH_COOKIE_NAME", "craftify_refresh")
    lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
    response.set_cookie(
        key=cookie_name,
        value=refresh_token,
        max_age=int(lifetime.total_seconds()),
        httponly=True,
        secure=not settings.DEBUG,
        samesite=getattr(settings, "AUTH_REFRESH_COOKIE_SAMESITE", "Lax"),
        path="/api/v1/auth/",
    )


def clear_refresh_cookie(response) -> None:
    """Remove the HttpOnly refresh cookie from the client browser."""
    cookie_name = getattr(settings, "AUTH_REFRESH_COOKIE_NAME", "craftify_refresh")
    response.delete_cookie(key=cookie_name, path="/api/v1/auth/")
