"""Starter unit and integration tests for Craftify authentication & security."""
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

User = get_user_model()


class CraftifyAuthSecurityTests(APITestCase):
    """Verifies public Buyer-only registration, role-based redirects, and auth guards."""

    def test_health_check_endpoint(self):
        response = self.client.get(reverse("api-health"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["service"], "craftify-django-api")
        self.assertEqual(response.data["currency"], "INR")

    def test_public_registration_always_creates_buyer_even_if_role_tampered(self):
        payload = {
            "full_name": "Priya Sharma",
            "username": "priya_craft",
            "email": "priya@craftify.in",
            "password": "StrongCraftPassword#2026",
            "confirm_password": "StrongCraftPassword#2026",
            "role": "ADMIN",  # Malicious privilege-escalation attempt must be ignored
        }
        response = self.client.post(reverse("auth-register"), payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"]["role"], User.Role.BUYER)
        self.assertEqual(response.data["redirect_url"], "/buyer/dashboard")

        db_user = User.objects.get(username="priya_craft")
        self.assertEqual(db_user.role, User.Role.BUYER)

    def test_login_returns_authoritative_redirect_for_each_role(self):
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

        admin_res = self.client.post(
            reverse("auth-login"),
            {"username": admin.username, "password": "AdminPassword#2026"},
            format="json",
        )
        self.assertEqual(admin_res.status_code, status.HTTP_200_OK)
        self.assertEqual(admin_res.data["redirect_url"], "/admin/dashboard")

    def test_profile_endpoint_blocks_unauthenticated_access(self):
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
