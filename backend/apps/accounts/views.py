"""API views for Craftify authentication, email verification, password recovery & sessions."""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .models import AuthActionToken
from .serializers import (
    LoginSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    RegisterSerializer,
    UserProfileSerializer,
    VerifyEmailSerializer,
)
from .services import (
    clear_refresh_cookie,
    consume_action_token,
    revoke_all_user_tokens,
    send_password_reset_email,
    send_verification_email,
    set_refresh_cookie,
)

User = get_user_model()


def _has_csrf_header_or_trusted_origin(request) -> bool:
    """
    Defense-in-depth CSRF check for cookie-authenticated POST endpoints.
    Requires the custom X-Requested-With header (sent by Axios) or a trusted Origin.
    """
    if request.headers.get("X-Requested-With") == "XMLHttpRequest":
        return True
    origin = request.headers.get("Origin", "")
    allowed = getattr(settings, "CORS_ALLOWED_ORIGINS", [])
    return bool(origin and origin in allowed)


class RegisterView(generics.CreateAPIView):
    """Public registration endpoint — always registers a BUYER account and sends verification email."""

    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    throttle_scope = "register"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        send_verification_email(user)

        refresh = RefreshToken.for_user(user)
        response = Response(
            {
                "message": "Account created successfully. Please check your email to verify your address.",
                "access": str(refresh.access_token),
                "user": UserProfileSerializer(user).data,
                "redirect_url": user.get_dashboard_redirect_url(),
            },
            status=status.HTTP_201_CREATED,
        )
        set_refresh_cookie(response, str(refresh))
        return response


class LoginView(APIView):
    """Unified login endpoint issuing short-lived access JWT + HttpOnly refresh cookie."""

    permission_classes = [AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = serializer.validated_data

        response = Response(
            {
                "access": validated["access"],
                "user": validated["user"],
                "redirect_url": validated["redirect_url"],
            },
            status=status.HTTP_200_OK,
        )
        set_refresh_cookie(response, validated["refresh"])
        return response


class CookieTokenRefreshView(APIView):
    """
    Silently refreshes the in-memory access token using the HttpOnly refresh cookie
    (or optional request body `refresh` for API clients/tests), rotating & blacklisting
    the old refresh token and enforcing active account status.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        cookie_name = getattr(settings, "AUTH_REFRESH_COOKIE_NAME", "craftify_refresh")
        cookie_token = request.COOKIES.get(cookie_name)
        raw_refresh = cookie_token or request.data.get("refresh")

        if cookie_token and not _has_csrf_header_or_trusted_origin(request):
            return Response(
                {"detail": "Missing required security header."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not raw_refresh:
            return Response(
                {"detail": "No active session found."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            old_refresh = RefreshToken(raw_refresh)
            user_id = old_refresh.get("user_id")
            user = User.objects.filter(id=user_id, is_active=True).first()
            if not user:
                raise TokenError("User inactive or missing.")

            # Rotate & blacklist old refresh token
            old_refresh.blacklist()
            new_refresh = RefreshToken.for_user(user)
        except TokenError:
            response = Response(
                {"detail": "Session expired. Please sign in again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            clear_refresh_cookie(response)
            return response

        response = Response(
            {
                "access": str(new_refresh.access_token),
                "user": UserProfileSerializer(user).data,
                "redirect_url": user.get_dashboard_redirect_url(),
            },
            status=status.HTTP_200_OK,
        )
        set_refresh_cookie(response, str(new_refresh))
        return response


class LogoutView(APIView):
    """Revokes current refresh token (cookie or body) and clears the HttpOnly cookie."""

    permission_classes = [AllowAny]

    def post(self, request):
        cookie_name = getattr(settings, "AUTH_REFRESH_COOKIE_NAME", "craftify_refresh")
        raw_refresh = request.COOKIES.get(cookie_name) or request.data.get("refresh")

        if request.COOKIES.get(cookie_name) and not _has_csrf_header_or_trusted_origin(request):
            return Response(
                {"detail": "Missing required security header."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except TokenError:
                pass

        response = Response(
            {"message": "Logged out successfully."},
            status=status.HTTP_200_OK,
        )
        clear_refresh_cookie(response)
        return response


class LogoutAllView(APIView):
    """Revokes all active sessions across all devices for the authenticated user."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        revoked_count = revoke_all_user_tokens(request.user)
        response = Response(
            {
                "message": "Signed out from all active devices.",
                "revoked_sessions": revoked_count,
            },
            status=status.HTTP_200_OK,
        )
        clear_refresh_cookie(response)
        return response


class VerifyEmailView(APIView):
    """Verifies a user's email address using a single-use hashed token."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = consume_action_token(
            serializer.validated_data["token"],
            AuthActionToken.Purpose.EMAIL_VERIFY,
        )
        if not user:
            return Response(
                {"detail": "This verification link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.is_email_verified:
            user.is_email_verified = True
            user.save(update_fields=["is_email_verified", "updated_at"])

        return Response(
            {
                "message": "Your email address has been verified successfully.",
                "user": UserProfileSerializer(user).data,
            },
            status=status.HTTP_200_OK,
        )


class ResendVerificationView(APIView):
    """Issues a fresh email verification link for an authenticated unverified user."""

    permission_classes = [IsAuthenticated]
    throttle_scope = "email_verification"

    def post(self, request):
        if request.user.is_email_verified:
            return Response(
                {"message": "Your email address is already verified."},
                status=status.HTTP_200_OK,
            )

        send_verification_email(request.user)
        return Response(
            {"message": "A new verification link has been sent to your email address."},
            status=status.HTTP_200_OK,
        )


class PasswordResetRequestView(APIView):
    """
    Sends a password reset link if the email exists.
    Always returns an identical 200 OK message to prevent account enumeration.
    """

    permission_classes = [AllowAny]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            send_password_reset_email(user)

        return Response(
            {
                "message": "If an account exists for that email address, a password reset link has been sent."
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """Consumes a single-use reset token, updates password, clears lockouts, and revokes all sessions."""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = consume_action_token(
            serializer.validated_data["token"],
            AuthActionToken.Purpose.PASSWORD_RESET,
        )
        if not user:
            return Response(
                {"detail": "This password reset link is invalid or has expired."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(serializer.validated_data["new_password"])
        user.password_changed_at = timezone.now()
        user.failed_login_attempts = 0
        user.locked_until = None
        user.save(
            update_fields=[
                "password",
                "password_changed_at",
                "failed_login_attempts",
                "locked_until",
                "updated_at",
            ]
        )
        revoke_all_user_tokens(user)

        return Response(
            {"message": "Password reset successful. Please sign in with your new password."},
            status=status.HTTP_200_OK,
        )


class PasswordChangeView(APIView):
    """Updates password for the authenticated user and revokes all other sessions."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        user = request.user
        user.set_password(serializer.validated_data["new_password"])
        user.password_changed_at = timezone.now()
        user.save(update_fields=["password", "password_changed_at", "updated_at"])

        # Revoke all old refresh tokens and issue a fresh session for current device
        revoke_all_user_tokens(user)
        new_refresh = RefreshToken.for_user(user)
        response = Response(
            {
                "message": "Password updated successfully. Other active sessions were signed out.",
                "access": str(new_refresh.access_token),
            },
            status=status.HTTP_200_OK,
        )
        set_refresh_cookie(response, str(new_refresh))
        return response


class MeView(generics.RetrieveUpdateAPIView):
    """Fetch or update the authenticated user's own profile (role is read-only)."""

    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        return self.request.user
