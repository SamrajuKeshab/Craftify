"""Week 12 Automated Security Audit & End-to-End Marketplace Smoke Tests."""
import hashlib
import hmac
import io
import json
import os
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.catalog.models import Category, Inventory, Product, ProductVariant
from apps.commerce.models import BuyerAddress
from apps.finance.models import LedgerEntry, SellerPayout
from apps.orders.models import Order, Payment
from apps.sellers.models import SellerProfile

User = get_user_model()


class Week12SecurityAndE2ETests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = User.objects.create_user(
            username="sec_admin",
            email="sec_admin@craftify.in",
            password="StrongPassword!123",
            role=User.Role.ADMIN,
            is_email_verified=True,
            is_staff=True,
        )
        self.buyer_one = User.objects.create_user(
            username="sec_buyer_one",
            email="sec_buyer_one@craftify.in",
            password="StrongPassword!123",
            role=User.Role.BUYER,
            is_email_verified=True,
            full_name="Ananya Iyer",
        )
        self.buyer_two = User.objects.create_user(
            username="sec_buyer_two",
            email="sec_buyer_two@craftify.in",
            password="StrongPassword!123",
            role=User.Role.BUYER,
            is_email_verified=True,
            full_name="Rohan Deshmukh",
        )
        self.seller_one = User.objects.create_user(
            username="sec_seller_one",
            email="sec_seller_one@craftify.in",
            password="StrongPassword!123",
            role=User.Role.SELLER,
            is_email_verified=True,
        )
        self.seller_two = User.objects.create_user(
            username="sec_seller_two",
            email="sec_seller_two@craftify.in",
            password="StrongPassword!123",
            role=User.Role.SELLER,
            is_email_verified=True,
        )

        self.studio_one = SellerProfile.objects.create(
            user=self.seller_one,
            shop_name="Jaipur Blue Pottery Works",
            slug="jaipur-blue-pottery-works",
            city="Jaipur",
            state="Rajasthan",
            pickup_address_json={"line1": "14 Johari Bazar", "city": "Jaipur", "pincode": "302003"},
            bank_account_masked="XXXX-XXXX-8899",
            ifsc_code="HDFC0001234",
        )
        self.studio_two = SellerProfile.objects.create(
            user=self.seller_two,
            shop_name="Channapatna Lacquer Guild",
            slug="channapatna-lacquer-guild",
            city="Ramanagara",
            state="Karnataka",
            pickup_address_json={"line1": "5 Toy Street", "city": "Channapatna", "pincode": "562160"},
            bank_account_masked="XXXX-XXXX-4455",
            ifsc_code="ICIC0004321",
        )

        self.category = Category.objects.create(
            name="Ceramic & Pottery",
            slug="ceramic-pottery",
            commission_rate=Decimal("10.00"),
        )
        self.product = Product.objects.create(
            seller=self.studio_one,
            category=self.category,
            title="Hand-Painted Jaipur Blue Vase",
            slug="hand-painted-jaipur-blue-vase",
            description="Traditional quartz-dough blue pottery vase hand-painted by master artisans.",
            base_price=Decimal("1800.00"),
            approval_status=Product.ApprovalStatus.APPROVED,
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            label="10-Inch Floral",
            sku="JPR-VASE-10",
            price_override=Decimal("1800.00"),
        )
        self.inventory = Inventory.objects.create(
            variant=self.variant,
            quantity_available=5,
            quantity_reserved=0,
        )
        self.address_one = BuyerAddress.objects.create(
            user=self.buyer_one,
            label=BuyerAddress.AddressLabel.HOME,
            recipient_name="Ananya Iyer",
            phone="9876501234",
            line1="42 Koramangala 4th Block",
            city="Bengaluru",
            state="Karnataka",
            pincode="560034",
        )

    def _create_cod_order_for_buyer_one(self):
        self.client.force_authenticate(user=self.buyer_one)
        add = self.client.post(
            "/api/v1/cart/items/",
            {"variant_id": str(self.variant.id), "quantity": 1},
            format="json",
        )
        self.assertIn(add.status_code, (200, 201))
        chk = self.client.post(
            "/api/v1/checkout/",
            {"address_id": str(self.address_one.id), "payment_method": "COD"},
            format="json",
        )
        self.assertEqual(chk.status_code, 201)
        return chk.data["order"]

    # ------------------------------------------------------------------
    # 1. Role Isolation & Privilege Escalation Prevention
    # ------------------------------------------------------------------
    def test_role_isolation_and_privilege_escalation_blocked(self):
        # Unauthenticated users blocked from private endpoints
        for url in (
            "/api/v1/auth/me/",
            "/api/v1/buyer/orders/",
            "/api/v1/seller/suborders/",
            "/api/v1/admin/dashboard/",
        ):
            self.assertEqual(self.client.get(url).status_code, 401, f"Expected 401 on {url}")

        # Public registration ignores any attempted role elevation
        reg = self.client.post(
            "/api/v1/auth/register/",
            {
                "username": "escalate_attempt",
                "email": "escalate@craftify.in",
                "password": "StrongPassword!123",
                "password_confirm": "StrongPassword!123",
                "full_name": "Test User",
                "role": "ADMIN",
                "is_staff": True,
            },
            format="json",
        )
        self.assertEqual(reg.status_code, 201)
        created = User.objects.get(username="escalate_attempt")
        self.assertEqual(created.role, User.Role.BUYER)
        self.assertFalse(created.is_staff)

        # Authenticated Buyer cannot elevate own role via /auth/me/
        self.client.force_authenticate(user=self.buyer_one)
        me_patch = self.client.patch(
            "/api/v1/auth/me/",
            {"full_name": "Ananya Iyer", "role": "ADMIN", "is_staff": True},
            format="json",
        )
        self.assertEqual(me_patch.status_code, 200)
        self.buyer_one.refresh_from_db()
        self.assertEqual(self.buyer_one.role, User.Role.BUYER)
        self.assertFalse(self.buyer_one.is_staff)

        # Buyer cannot access Seller or Admin governance endpoints
        for forbidden_url in (
            "/api/v1/seller/suborders/",
            "/api/v1/seller/finance/",
            "/api/v1/seller/analytics/",
            "/api/v1/admin/dashboard/",
            "/api/v1/admin/finance/",
            "/api/v1/admin/analytics/",
            "/api/v1/admin/audit-logs/",
        ):
            self.assertEqual(
                self.client.get(forbidden_url).status_code,
                403,
                f"Buyer should receive 403 on {forbidden_url}",
            )

        # Seller cannot access Admin governance endpoints
        self.client.force_authenticate(user=self.seller_one)
        for admin_url in (
            "/api/v1/admin/dashboard/",
            "/api/v1/admin/finance/",
            "/api/v1/admin/analytics/",
            "/api/v1/admin/orders/",
        ):
            self.assertEqual(
                self.client.get(admin_url).status_code,
                403,
                f"Seller should receive 403 on {admin_url}",
            )

    # ------------------------------------------------------------------
    # 2. Cross-Tenant (IDOR) Isolation Across Buyers & Sellers
    # ------------------------------------------------------------------
    def test_cross_tenant_buyer_and_seller_isolation(self):
        order_data = self._create_cod_order_for_buyer_one()
        order_id = order_data["id"]
        suborder_id = order_data["suborders"][0]["id"]

        # Buyer Two cannot read or cancel Buyer One's order or delete Buyer One's address
        self.client.force_authenticate(user=self.buyer_two)
        self.assertEqual(self.client.get(f"/api/v1/buyer/orders/{order_id}/").status_code, 404)
        self.assertIn(
            self.client.post(f"/api/v1/buyer/orders/{order_id}/cancel/").status_code,
            (400, 403, 404),
        )
        self.assertEqual(
            self.client.delete(f"/api/v1/buyer/addresses/{self.address_one.id}/").status_code,
            404,
        )

        # Seller Two cannot mutate Seller One's suborder or Seller One's product
        self.client.force_authenticate(user=self.seller_two)
        self.assertIn(
            self.client.patch(
                f"/api/v1/seller/suborders/{suborder_id}/status/",
                {"status": "ACCEPTED"},
                format="json",
            ).status_code,
            (400, 403, 404),
        )
        self.assertEqual(
            self.client.patch(
                f"/api/v1/seller/products/{self.product.id}/",
                {"title": "Hijacked Product Title"},
                format="json",
            ).status_code,
            404,
        )

    # ------------------------------------------------------------------
    # 3. Defense-in-Depth Security Headers & No-Store Cache Control
    # ------------------------------------------------------------------
    def test_security_headers_and_sensitive_no_store_cache_policy(self):
        health = self.client.get("/api/v1/health/")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health["X-Content-Type-Options"], "nosniff")
        self.assertEqual(health["X-Frame-Options"], "DENY")
        self.assertEqual(health["Referrer-Policy"], "strict-origin-when-cross-origin")
        self.assertIn("payment=(self)", health["Permissions-Policy"])
        self.assertEqual(health["Cross-Origin-Opener-Policy"], "same-origin-allow-popups")

        # Sensitive auth & admin routes enforce no-store caching
        self.client.force_authenticate(user=self.admin)
        for sensitive_url in (
            "/api/v1/auth/me/",
            "/api/v1/admin/dashboard/",
        ):
            res = self.client.get(sensitive_url)
            self.assertEqual(res.status_code, 200)
            self.assertIn("no-store", res["Cache-Control"])
            self.assertEqual(res["Pragma"], "no-cache")

    # ------------------------------------------------------------------
    # 4. HttpOnly Refresh Cookie CSRF Header Enforcement
    # ------------------------------------------------------------------
    def test_refresh_cookie_csrf_header_enforcement(self):
        login_res = self.client.post(
            "/api/v1/auth/login/",
            {"username": "sec_buyer_one", "password": "StrongPassword!123"},
            format="json",
        )
        self.assertEqual(login_res.status_code, 200)
        refresh_cookie = login_res.cookies.get("craftify_refresh")
        self.assertIsNotNone(refresh_cookie)
        self.assertTrue(refresh_cookie["httponly"])

        # Cookie refresh WITHOUT X-Requested-With or trusted Origin is rejected (403)
        blocked = self.client.post("/api/v1/auth/token/refresh/", {}, format="json")
        self.assertEqual(blocked.status_code, 403)

        # Cookie refresh WITH X-Requested-With succeeds and rotates access token
        allowed = self.client.post(
            "/api/v1/auth/token/refresh/",
            {},
            format="json",
            HTTP_X_REQUESTED_WITH="XMLHttpRequest",
        )
        self.assertEqual(allowed.status_code, 200)
        self.assertIn("access", allowed.data)

    # ------------------------------------------------------------------
    # 5. Razorpay Live Webhook HMAC-SHA256 & order.paid Idempotency
    # ------------------------------------------------------------------
    @patch("apps.orders.services.create_razorpay_order")
    def test_razorpay_webhook_signature_validation_and_order_paid_idempotency(
        self, mock_rzp_order
    ):
        mock_rzp_order.return_value = {
            "razorpay_order_id": "order_sec_live_1001",
            "amount_paise": 180000,
            "currency": "INR",
            "key_id": "rzp_test_sec123",
        }

        self.client.force_authenticate(user=self.buyer_one)
        self.client.post(
            "/api/v1/cart/items/",
            {"variant_id": str(self.variant.id), "quantity": 1},
            format="json",
        )
        chk = self.client.post(
            "/api/v1/checkout/",
            {"address_id": str(self.address_one.id), "payment_method": "RAZORPAY"},
            format="json",
        )
        self.assertEqual(chk.status_code, 201)
        order_id = chk.data["order"]["id"]

        webhook_secret = "whsec_craftify_week12_super_secret"
        payload_dict = {
            "id": "evt_order_paid_001",
            "event": "order.paid",
            "created_at": 1730000000,
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_sec_live_9999",
                        "order_id": "order_sec_live_1001",
                        "status": "captured",
                        "method": "upi",
                        "amount": 180000,
                    }
                },
                "order": {
                    "entity": {
                        "id": "order_sec_live_1001",
                        "status": "paid",
                        "amount_paid": 180000,
                    }
                },
            },
        }
        raw_body = json.dumps(payload_dict).encode("utf-8")
        valid_sig = hmac.new(
            webhook_secret.encode("utf-8"), raw_body, hashlib.sha256
        ).hexdigest()

        self.client.force_authenticate(user=None)
        with patch.dict(os.environ, {"RAZORPAY_WEBHOOK_SECRET": webhook_secret}):
            # Forged signature -> rejected
            bad = self.client.post(
                "/api/v1/payments/razorpay/webhook/",
                data=raw_body,
                content_type="application/json",
                HTTP_X_RAZORPAY_SIGNATURE="forged_signature_12345",
            )
            self.assertEqual(bad.status_code, 400)

            # Empty body -> rejected
            empty = self.client.post(
                "/api/v1/payments/razorpay/webhook/",
                data=b"",
                content_type="application/json",
                HTTP_X_RAZORPAY_SIGNATURE=valid_sig,
            )
            self.assertEqual(empty.status_code, 400)

            # Valid signed order.paid -> captures payment & confirms order
            ok = self.client.post(
                "/api/v1/payments/razorpay/webhook/",
                data=raw_body,
                content_type="application/json",
                HTTP_X_RAZORPAY_SIGNATURE=valid_sig,
                HTTP_X_RAZORPAY_EVENT_ID="evt_order_paid_001",
            )
            self.assertEqual(ok.status_code, 200)

            order = Order.objects.get(pk=order_id)
            payment = Payment.objects.get(order=order)
            self.assertEqual(order.overall_status, Order.OverallStatus.CONFIRMED)
            self.assertEqual(payment.status, Payment.Status.CAPTURED)
            self.assertEqual(payment.razorpay_payment_id, "pay_sec_live_9999")

            # Replay same webhook -> strictly idempotent (200, stock not double-deducted)
            replay = self.client.post(
                "/api/v1/payments/razorpay/webhook/",
                data=raw_body,
                content_type="application/json",
                HTTP_X_RAZORPAY_SIGNATURE=valid_sig,
                HTTP_X_RAZORPAY_EVENT_ID="evt_order_paid_001",
            )
            self.assertEqual(replay.status_code, 200)
            self.inventory.refresh_from_db()
            self.assertEqual(self.inventory.quantity_available, 4)
            self.assertEqual(self.inventory.quantity_reserved, 0)

    # ------------------------------------------------------------------
    # 6. Full Marketplace E2E Lifecycle + Readiness Audit Command
    # ------------------------------------------------------------------
    def test_full_marketplace_e2e_smoke_flow_and_readiness_command(self):
        # 1. Buyer checks out via COD
        order_data = self._create_cod_order_for_buyer_one()
        sub = order_data["suborders"][0]
        sub_id = sub["id"]
        order_item_id = sub["items"][0]["id"]

        # 2. Seller accepts, packs, dispatches with Blue Dart, and delivers
        self.client.force_authenticate(user=self.seller_one)
        for next_st in ("ACCEPTED", "PACKED"):
            res = self.client.patch(
                f"/api/v1/seller/suborders/{sub_id}/status/",
                {"status": next_st},
                format="json",
            )
            self.assertEqual(res.status_code, 200)

        ship = self.client.post(
            f"/api/v1/seller/suborders/{sub_id}/ship/",
            {"courier_name": "Blue Dart", "tracking_number": "BLDE2E998877"},
            format="json",
        )
        self.assertEqual(ship.status_code, 201)

        deliv = self.client.post(
            f"/api/v1/seller/suborders/{sub_id}/deliver/",
            {"delivery_notes": "Handed to buyer"},
            format="json",
        )
        self.assertEqual(deliv.status_code, 200)

        # 3. Admin releases 7-day settlement hold early -> Seller withdraws -> Admin marks PAID
        sale_credit = LedgerEntry.objects.get(
            seller=self.studio_one,
            entry_type=LedgerEntry.EntryType.SALE_CREDIT,
        )
        self.client.force_authenticate(user=self.admin)
        release = self.client.post(
            f"/api/v1/admin/finance/ledger/{sale_credit.id}/release-hold/",
            {"reason": "E2E smoke verification"},
            format="json",
        )
        self.assertEqual(release.status_code, 200)

        self.client.force_authenticate(user=self.seller_one)
        payout_res = self.client.post(
            "/api/v1/seller/finance/payouts/",
            {"amount": "1620.00", "seller_notes": "Weekly studio withdrawal"},
            format="json",
        )
        self.assertEqual(payout_res.status_code, 201)
        payout_id = payout_res.data["payout"]["id"]

        self.client.force_authenticate(user=self.admin)
        paid_res = self.client.post(
            f"/api/v1/admin/finance/payouts/{payout_id}/action/",
            {"status": SellerPayout.Status.PAID, "utr_reference": "UTR2026E2E12345"},
            format="json",
        )
        self.assertEqual(paid_res.status_code, 200)

        # 4. Buyer submits verified 5-star review
        self.client.force_authenticate(user=self.buyer_one)
        rev_res = self.client.post(
            "/api/v1/buyer/reviews/",
            {
                "order_item_id": order_item_id,
                "rating": 5,
                "title": "Stunning Jaipur blue glaze",
                "comment": "Arrived safely in double-corrugated packaging. Authentic craft.",
            },
            format="json",
        )
        self.assertEqual(rev_res.status_code, 201)

        # 5. Admin analytics reflects live order, commission & 5.00 rating
        self.client.force_authenticate(user=self.admin)
        analytics = self.client.get("/api/v1/admin/analytics/")
        self.assertEqual(analytics.status_code, 200)
        self.assertEqual(analytics.data["quality_metrics"]["platform_rating_avg"], "5.00")
        self.assertEqual(analytics.data["quality_metrics"]["total_published_reviews"], 1)

        # 6. Production readiness management command runs cleanly
        out = io.StringIO()
        call_command("check_production_readiness", stdout=out)
        output_text = out.getvalue()
        self.assertIn("Craftify Production Readiness Audit", output_text)
        self.assertIn("Database:", output_text)
        self.assertIn("Admin Account:", output_text)
