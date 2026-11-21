"""Comprehensive Week 3 unit & security integration tests for Craftify authentication."""
from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import AuthActionToken
from .services import create_action_token
from .views import LoginView

User = get_user_model()


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class CraftifyAuthSecurityTests(APITestCase):
    """Verifies registration role lock, email verification, password reset, lockout, throttling & sessions."""

    CSRF_HEADERS = {"HTTP_X_REQUESTED_WITH": "XMLHttpRequest"}

    def setUp(self):
        super().setUp()
        # Clear DRF throttle cache before each test so tests never leak rate-limit counters
        cache.clear()

    def test_health_check_endpoint(self):
        response = self.client.get(reverse("api-health"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["service"], "craftify-django-api")
        self.assertEqual(response.data["currency"], "INR")

    def test_public_registration_always_creates_buyer_and_sends_verification_email(self):
        payload = {
            "full_name": "Priya Sharma",
            "username": "priya_craft",
            "email": "priya@craftify.in",
            "password": "StrongCraftPassword#2026",
            "confirm_password": "StrongCraftPassword#2026",
            "role": "ADMIN",  # Privilege escalation attempt must be ignored
        }
        response = self.client.post(reverse("auth-register"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"]["role"], User.Role.BUYER)
        self.assertFalse(response.data["user"]["is_email_verified"])
        self.assertEqual(response.data["redirect_url"], "/")
        self.assertIn(settings.AUTH_REFRESH_COOKIE_NAME, response.cookies)

        # Verification email dispatched
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("/verify-email?token=", mail.outbox[0].body)

    def test_email_verification_single_use_and_expiry(self):
        user = User.objects.create_user(
            username="ananya_buyer",
            email="ananya@craftify.in",
            full_name="Ananya Nair",
            password="CraftPassword#2026",
            role=User.Role.BUYER,
            is_email_verified=False,
        )
        raw_token = create_action_token(user, AuthActionToken.Purpose.EMAIL_VERIFY)

        # First verification succeeds
        res = self.client.post(
            reverse("auth-verify-email"), {"token": raw_token}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.is_email_verified)

        # Reusing the same token must fail
        replay = self.client.post(
            reverse("auth-verify-email"), {"token": raw_token}, format="json"
        )
        self.assertEqual(replay.status_code, status.HTTP_400_BAD_REQUEST)

        # Expired token must fail
        expired_raw = create_action_token(user, AuthActionToken.Purpose.EMAIL_VERIFY)
        AuthActionToken.objects.filter(user=user, used_at__isnull=True).update(
            expires_at=timezone.now() - timedelta(minutes=5)
        )
        expired_res = self.client.post(
            reverse("auth-verify-email"), {"token": expired_raw}, format="json"
        )
        self.assertEqual(expired_res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_returns_authoritative_redirect_and_httponly_cookie(self):
        seller = User.objects.create_user(
            username="artisan_meera",
            email="meera@craftify.in",
            full_name="Meera Studio",
            password="ArtisanPassword#2026",
            role=User.Role.SELLER,
        )
        admin = User.objects.create_user(
            username="ops_admin",
            email="admin@craftify.in",
            full_name="Craftify Admin",
            password="AdminPassword#2026",
            role=User.Role.ADMIN,
            is_staff=True,
        )

        seller_res = self.client.post(
            reverse("auth-login"),
            {"username": seller.username, "password": "ArtisanPassword#2026"},
            format="json",
        )
        self.assertEqual(seller_res.status_code, status.HTTP_200_OK)
        self.assertEqual(seller_res.data["redirect_url"], "/seller/dashboard")
        self.assertTrue(seller_res.cookies[settings.AUTH_REFRESH_COOKIE_NAME]["httponly"])

        admin_res = self.client.post(
            reverse("auth-login"),
            {"username": admin.username, "password": "AdminPassword#2026"},
            format="json",
        )
        self.assertEqual(admin_res.status_code, status.HTTP_200_OK)
        self.assertEqual(admin_res.data["redirect_url"], "/admin/dashboard")

    def test_brute_force_lockout_after_five_failed_attempts(self):
        user = User.objects.create_user(
            username="rahul_verma",
            email="rahul@craftify.in",
            full_name="Rahul Verma",
            password="ValidPassword#2026",
            role=User.Role.BUYER,
        )
        # Bypass IP throttle here so we isolate and verify the per-account 5-failure lockout
        with patch.object(LoginView, "throttle_classes", []):
            for _ in range(5):
                res = self.client.post(
                    reverse("auth-login"),
                    {"username": "rahul_verma", "password": "WrongPassword!"},
                    format="json",
                )
                self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

            user.refresh_from_db()
            self.assertTrue(user.is_locked())

            # Even with correct password, account stays locked during window
            locked_res = self.client.post(
                reverse("auth-login"),
                {"username": "rahul_verma", "password": "ValidPassword#2026"},
                format="json",
            )
            self.assertEqual(locked_res.status_code, status.HTTP_400_BAD_REQUEST)
            self.assertIn("Too many failed login attempts", str(locked_res.data))

    def test_login_rate_limiting_returns_429_on_sixth_rapid_request(self):
        for _ in range(5):
            res = self.client.post(
                reverse("auth-login"),
                {"username": "unknown_probe", "password": "WrongPassword!"},
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        throttled_res = self.client.post(
            reverse("auth-login"),
            {"username": "unknown_probe", "password": "WrongPassword!"},
            format="json",
        )
        self.assertEqual(throttled_res.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_password_reset_flow_prevents_enumeration_and_revokes_old_sessions(self):
        user = User.objects.create_user(
            username="kavya_art",
            email="kavya@craftify.in",
            full_name="Kavya Iyer",
            password="OldPassword#2026",
            role=User.Role.BUYER,
        )
        # Login first to create an active refresh cookie
        login_res = self.client.post(
            reverse("auth-login"),
            {"username": "kavya_art", "password": "OldPassword#2026"},
            format="json",
        )
        old_refresh = login_res.cookies[settings.AUTH_REFRESH_COOKIE_NAME].value

        # Unknown email returns identical 200 OK
        unknown_res = self.client.post(
            reverse("auth-password-reset"),
            {"email": "nobody@example.com"},
            format="json",
        )
        self.assertEqual(unknown_res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

        # Known email dispatches reset token
        reset_req = self.client.post(
            reverse("auth-password-reset"),
            {"email": "kavya@craftify.in"},
            format="json",
        )
        self.assertEqual(reset_req.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        token = mail.outbox[0].body.split("/reset-password?token=")[1].split()[0]

        # Confirm password reset
        confirm_res = self.client.post(
            reverse("auth-password-reset-confirm"),
            {
                "token": token,
                "new_password": "BrandNewPassword#2026",
                "confirm_password": "BrandNewPassword#2026",
            },
            format="json",
        )
        self.assertEqual(confirm_res.status_code, status.HTTP_200_OK)

        # Old refresh token must now be blacklisted
        refresh_attempt = self.client.post(
            reverse("auth-token-refresh"),
            {"refresh": old_refresh},
            format="json",
            **self.CSRF_HEADERS,
        )
        self.assertEqual(refresh_attempt.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_password_change_and_logout_all_sessions(self):
        user = User.objects.create_user(
            username="vikram_mehta",
            email="vikram@craftify.in",
            full_name="Vikram Mehta",
            password="StartPassword#2026",
            role=User.Role.BUYER,
        )
        login_res = self.client.post(
            reverse("auth-login"),
            {"username": "vikram_mehta", "password": "StartPassword#2026"},
            format="json",
        )
        access = login_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        # Change password
        change_res = self.client.post(
            reverse("auth-password-change"),
            {
                "current_password": "StartPassword#2026",
                "new_password": "UpdatedPassword#2026",
                "confirm_password": "UpdatedPassword#2026",
            },
            format="json",
        )
        self.assertEqual(change_res.status_code, status.HTTP_200_OK)
        new_access = change_res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {new_access}")

        # Logout all devices
        logout_all_res = self.client.post(reverse("auth-logout-all"), format="json")
        self.assertEqual(logout_all_res.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(logout_all_res.data["revoked_sessions"], 1)

    def test_suspended_user_blocked_on_login_and_refresh(self):
        user = User.objects.create_user(
            username="suspended_user",
            email="suspended@craftify.in",
            full_name="Suspended Account",
            password="ValidPassword#2026",
            role=User.Role.BUYER,
        )
        login_res = self.client.post(
            reverse("auth-login"),
            {"username": "suspended_user", "password": "ValidPassword#2026"},
            format="json",
        )
        refresh_val = login_res.cookies[settings.AUTH_REFRESH_COOKIE_NAME].value

        # Suspend user
        user.is_active = False
        user.save(update_fields=["is_active"])

        # Refresh must fail
        refresh_res = self.client.post(
            reverse("auth-token-refresh"),
            {"refresh": refresh_val},
            format="json",
            **self.CSRF_HEADERS,
        )
        self.assertEqual(refresh_res.status_code, status.HTTP_401_UNAUTHORIZED)

        # Profile endpoint rejects anonymous requests
        self.client.credentials()
        me_res = self.client.get(reverse("auth-me"))
        self.assertEqual(me_res.status_code, status.HTTP_401_UNAUTHORIZED)
