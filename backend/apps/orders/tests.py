"""Week 8 automated API tests: Multi-Vendor Splitting, Stock Locking, Razorpay HMAC & COD."""
import hashlib
import hmac
import json
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.catalog.models import Category, Inventory, InventoryTransaction, Product, ProductVariant
from apps.commerce.models import BuyerAddress, Coupon, CouponUsage
from apps.orders.models import Order, PaymentTransaction, SellerSuborder
from apps.sellers.models import SellerProfile

User = get_user_model()


class MultiVendorOrdersAndPaymentsTestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="ord_admin",
            email="ord_admin@craftify.in",
            password="StrongPassword!123",
            full_name="Orders Admin",
            role=User.Role.ADMIN,
            is_staff=True,
            is_email_verified=True,
        )
        self.buyer = User.objects.create_user(
            username="ord_buyer",
            email="ord_buyer@craftify.in",
            password="StrongPassword!123",
            full_name="Meera Deshmukh",
            role=User.Role.BUYER,
            is_email_verified=True,
        )
        self.seller_user_a = User.objects.create_user(
            username="studio_a",
            email="studio_a@craftify.in",
            password="StrongPassword!123",
            full_name="Ramesh Kumhar",
            role=User.Role.SELLER,
            is_email_verified=True,
        )
        self.seller_user_b = User.objects.create_user(
            username="studio_b",
            email="studio_b@craftify.in",
            password="StrongPassword!123",
            full_name="Lakshmi Weaver",
            role=User.Role.SELLER,
            is_email_verified=True,
        )

        self.seller_a = SellerProfile.objects.create(
            user=self.seller_user_a,
            shop_name="Jaipur Terracotta Guild",
            slug="jaipur-terracotta-guild",
            primary_category="Pottery",
            city="Jaipur",
            state="Rajasthan",
            pickup_address_json={
                "line1": "14 Johari Bazar",
                "city": "Jaipur",
                "state": "Rajasthan",
                "pincode": "302003",
            },
        )
        self.seller_b = SellerProfile.objects.create(
            user=self.seller_user_b,
            shop_name="Kutch Handloom Co",
            slug="kutch-handloom-co",
            primary_category="Textiles",
            city="Bhuj",
            state="Gujarat",
            pickup_address_json={
                "line1": "8 Bhujodi Lane",
                "city": "Bhuj",
                "state": "Gujarat",
                "pincode": "370001",
            },
        )

        self.cat_pottery = Category.objects.create(
            name="Pottery & Clay",
            slug="pottery-clay",
            commission_rate=Decimal("10.00"),
            is_active=True,
        )
        self.cat_textile = Category.objects.create(
            name="Handloom Textiles",
            slug="handloom-textiles",
            commission_rate=Decimal("12.00"),
            is_active=True,
        )

        # Product A (Seller A, ₹1,200, stock 4)
        self.product_a = Product.objects.create(
            seller=self.seller_a,
            category=self.cat_pottery,
            title="Hand-Painted Blue Pottery Vase",
            slug="blue-pottery-vase",
            description="Authentic Jaipur blue pottery.",
            base_price=Decimal("1200.00"),
            approval_status=Product.ApprovalStatus.APPROVED,
        )
        self.variant_a = ProductVariant.objects.create(
            product=self.product_a,
            sku="JTG-VASE-01",
            label="Standard 10-inch",
            price_override=Decimal("1200.00"),
            is_active=True,
        )
        self.inv_a = Inventory.objects.create(
            variant=self.variant_a,
            quantity_available=4,
            quantity_reserved=0,
        )

        # Product B (Seller B, ₹800, stock 5)
        self.product_b = Product.objects.create(
            seller=self.seller_b,
            category=self.cat_textile,
            title="Kutch Kala Cotton Stole",
            slug="kutch-kala-cotton-stole",
            description="Handwoven kala cotton stole.",
            base_price=Decimal("800.00"),
            approval_status=Product.ApprovalStatus.APPROVED,
        )
        self.variant_b = ProductVariant.objects.create(
            product=self.product_b,
            sku="KHC-STOLE-01",
            label="Indigo Natural Dye",
            price_override=Decimal("800.00"),
            is_active=True,
        )
        self.inv_b = Inventory.objects.create(
            variant=self.variant_b,
            quantity_available=5,
            quantity_reserved=0,
        )

        # High-value product for COD ₹5,000 cap test
        self.product_expensive = Product.objects.create(
            seller=self.seller_b,
            category=self.cat_textile,
            title="Heritage Patola Silk Saree",
            slug="heritage-patola-silk-saree",
            description="Double ikat heirloom saree.",
            base_price=Decimal("6500.00"),
            approval_status=Product.ApprovalStatus.APPROVED,
        )
        self.variant_exp = ProductVariant.objects.create(
            product=self.product_expensive,
            sku="KHC-SAREE-01",
            label="6.2m with Blouse",
            price_override=Decimal("6500.00"),
            is_active=True,
        )
        self.inv_exp = Inventory.objects.create(
            variant=self.variant_exp,
            quantity_available=2,
            quantity_reserved=0,
        )

        self.address = BuyerAddress.objects.create(
            user=self.buyer,
            label=BuyerAddress.AddressLabel.HOME,
            recipient_name="Meera Deshmukh",
            phone="9876543210",
            line1="42 FC Road, Shivajinagar",
            city="Pune",
            state="Maharashtra",
            pincode="411004",
            is_default=True,
        )

        now = timezone.now()
        self.coupon = Coupon.objects.create(
            code="CRAFT200",
            description="Flat ₹200 off orders above ₹1,500",
            discount_type=Coupon.DiscountType.FIXED,
            value=Decimal("200.00"),
            min_order_amount=Decimal("1500.00"),
            valid_from=now - timedelta(days=1),
            valid_until=now + timedelta(days=30),
            max_uses=50,
            per_user_limit=2,
            is_active=True,
            created_by=self.admin,
        )

    def _add_to_cart(self, variant, quantity=1, note=""):
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(
            "/api/v1/cart/items/",
            {
                "variant_id": str(variant.id),
                "quantity": quantity,
                "customization_note": note,
            },
            format="json",
        )
        self.assertIn(res.status_code, (200, 201))

    def test_multi_vendor_cod_checkout_splits_suborders_commissions_and_locks_stock(self):
        """Cart across 2 sellers + coupon splits into 2 SellerSuborders with exact commission & stock deduction."""
        self._add_to_cart(self.variant_a, quantity=1)
        self._add_to_cart(self.variant_b, quantity=1)

        apply_res = self.client.post(
            "/api/v1/cart/apply-coupon/", {"code": "CRAFT200"}, format="json"
        )
        self.assertEqual(apply_res.status_code, 200)

        checkout_res = self.client.post(
            "/api/v1/checkout/",
            {
                "address_id": str(self.address.id),
                "payment_method": "COD",
                "idempotency_key": "idem-cod-001",
            },
            format="json",
        )
        self.assertEqual(checkout_res.status_code, 201)
        order_data = checkout_res.data["order"]
        self.assertEqual(order_data["payment_method"], "COD")
        self.assertEqual(order_data["payment_status"], "COD_PENDING")
        self.assertEqual(order_data["overall_status"], "CONFIRMED")
        self.assertEqual(Decimal(order_data["subtotal_amount"]), Decimal("2000.00"))
        self.assertEqual(Decimal(order_data["discount_amount"]), Decimal("200.00"))
        self.assertEqual(Decimal(order_data["shipping_amount"]), Decimal("0.00"))
        self.assertEqual(Decimal(order_data["total_amount"]), Decimal("1800.00"))
        self.assertEqual(len(order_data["suborders"]), 2)

        # Verify zero-paise-drift proportional discount + category commission on discounted net
        by_shop = {s["seller_shop_name_snapshot"]: s for s in order_data["suborders"]}
        sub_a = by_shop["Jaipur Terracotta Guild"]
        sub_b = by_shop["Kutch Handloom Co"]
        self.assertEqual(Decimal(sub_a["discount_share"]), Decimal("120.00"))
        self.assertEqual(Decimal(sub_b["discount_share"]), Decimal("80.00"))
        # 10% of (1200 - 120 = 1080) = 108.00; 12% of (800 - 80 = 720) = 86.40
        self.assertEqual(Decimal(sub_a["commission_amount"]), Decimal("108.00"))
        self.assertEqual(Decimal(sub_b["commission_amount"]), Decimal("86.40"))
        self.assertEqual(Decimal(sub_a["net_seller_amount"]), Decimal("972.00"))
        self.assertEqual(Decimal(sub_b["net_seller_amount"]), Decimal("633.60"))

        # Verify inventory deducted & logged
        self.inv_a.refresh_from_db()
        self.inv_b.refresh_from_db()
        self.assertEqual(self.inv_a.quantity_available, 3)
        self.assertEqual(self.inv_b.quantity_available, 4)
        self.assertEqual(
            InventoryTransaction.objects.filter(
                change_type=InventoryTransaction.ChangeType.DEDUCT
            ).count(),
            2,
        )

        # Verify coupon redeemed and cart cleared
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.used_count, 1)
        self.assertEqual(CouponUsage.objects.filter(coupon=self.coupon).count(), 1)
        cart_res = self.client.get("/api/v1/cart/")
        self.assertEqual(cart_res.data["item_count"], 0)

        # Idempotent replay returns same order without duplicating stock deduction
        replay_res = self.client.post(
            "/api/v1/checkout/",
            {
                "address_id": str(self.address.id),
                "payment_method": "COD",
                "idempotency_key": "idem-cod-001",
            },
            format="json",
        )
        self.assertEqual(replay_res.status_code, 201)
        self.assertEqual(replay_res.data["order"]["id"], order_data["id"])
        self.inv_a.refresh_from_db()
        self.assertEqual(self.inv_a.quantity_available, 3)

    def test_cod_rejected_above_5000_inr_cap(self):
        """Server enforces ₹5,000 Cash on Delivery limit even if client posts payment_method=COD."""
        self._add_to_cart(self.variant_exp, quantity=1)
        res = self.client.post(
            "/api/v1/checkout/",
            {"address_id": str(self.address.id), "payment_method": "COD"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("payment_method", res.data)
        self.inv_exp.refresh_from_db()
        self.assertEqual(self.inv_exp.quantity_available, 2)

    def test_insufficient_stock_prevents_oversell_atomically(self):
        """If stock drops after item entered cart, checkout fails cleanly without touching inventory."""
        self._add_to_cart(self.variant_a, quantity=3)
        # Another buyer consumes stock before checkout
        self.inv_a.quantity_available = 1
        self.inv_a.save(update_fields=["quantity_available"])

        res = self.client.post(
            "/api/v1/checkout/",
            {"address_id": str(self.address.id), "payment_method": "COD"},
            format="json",
        )
        self.assertEqual(res.status_code, 400)
        self.inv_a.refresh_from_db()
        self.assertEqual(self.inv_a.quantity_available, 1)
        self.assertEqual(Order.objects.count(), 0)

    @patch.dict(
        "os.environ",
        {
            "RAZORPAY_KEY_ID": "rzp_test_unit123",
            "RAZORPAY_KEY_SECRET": "test_secret_abc999",
            "RAZORPAY_WEBHOOK_SECRET": "wh_secret_xyz777",
        },
    )
    @patch("apps.orders.services.create_razorpay_order")
    def test_razorpay_checkout_hmac_verification_and_tamper_rejection(self, mock_create_rzp):
        """Razorpay checkout reserves stock, rejects tampered HMAC, and confirms on valid HMAC."""
        mock_create_rzp.return_value = {
            "razorpay_order_id": "order_RzpUnit001",
            "amount_paise": 120000,
            "currency": "INR",
            "key_id": "rzp_test_unit123",
        }
        self._add_to_cart(self.variant_a, quantity=1)

        res = self.client.post(
            "/api/v1/checkout/",
            {"address_id": str(self.address.id), "payment_method": "RAZORPAY"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        order_id = res.data["order"]["id"]
        self.assertEqual(res.data["order"]["overall_status"], "PENDING_PAYMENT")
        self.assertEqual(res.data["razorpay"]["razorpay_order_id"], "order_RzpUnit001")

        # Stock is reserved, not yet permanently deducted
        self.inv_a.refresh_from_db()
        self.assertEqual(self.inv_a.quantity_available, 3)
        self.assertEqual(self.inv_a.quantity_reserved, 1)

        # Tampered signature rejected
        bad_verify = self.client.post(
            "/api/v1/payments/razorpay/verify/",
            {
                "order_id": order_id,
                "razorpay_order_id": "order_RzpUnit001",
                "razorpay_payment_id": "pay_Unit001",
                "razorpay_signature": "forged_signature",
            },
            format="json",
        )
        self.assertEqual(bad_verify.status_code, 400)

        # Valid HMAC-SHA256 signature confirms payment & clears cart
        valid_sig = hmac.new(
            b"test_secret_abc999",
            b"order_RzpUnit001|pay_Unit001",
            hashlib.sha256,
        ).hexdigest()
        ok_verify = self.client.post(
            "/api/v1/payments/razorpay/verify/",
            {
                "order_id": order_id,
                "razorpay_order_id": "order_RzpUnit001",
                "razorpay_payment_id": "pay_Unit001",
                "razorpay_signature": valid_sig,
            },
            format="json",
        )
        self.assertEqual(ok_verify.status_code, 200)
        self.assertEqual(ok_verify.data["order"]["payment_status"], "PAID")
        self.assertEqual(ok_verify.data["order"]["overall_status"], "CONFIRMED")

        self.inv_a.refresh_from_db()
        self.assertEqual(self.inv_a.quantity_available, 3)
        self.assertEqual(self.inv_a.quantity_reserved, 0)

    @patch.dict(
        "os.environ",
        {
            "RAZORPAY_KEY_ID": "rzp_test_unit123",
            "RAZORPAY_KEY_SECRET": "test_secret_abc999",
            "RAZORPAY_WEBHOOK_SECRET": "wh_secret_xyz777",
        },
    )
    @patch("apps.orders.services.create_razorpay_order")
    def test_razorpay_webhook_signature_and_idempotency(self, mock_create_rzp):
        """Webhook rejects bad signature and processes payment.captured idempotently on replay."""
        mock_create_rzp.return_value = {
            "razorpay_order_id": "order_RzpHook002",
            "amount_paise": 87900,
            "currency": "INR",
            "key_id": "rzp_test_unit123",
        }
        self._add_to_cart(self.variant_b, quantity=1)
        res = self.client.post(
            "/api/v1/checkout/",
            {"address_id": str(self.address.id), "payment_method": "RAZORPAY"},
            format="json",
        )
        self.assertEqual(res.status_code, 201)
        order_id = res.data["order"]["id"]

        payload = {
            "event": "payment.captured",
            "id": "evt_test_002",
            "payload": {
                "payment": {
                    "entity": {
                        "id": "pay_Hook002",
                        "order_id": "order_RzpHook002",
                        "status": "captured",
                        "amount": 87900,
                        "method": "upi",
                    }
                }
            },
        }
        raw_body = json.dumps(payload).encode("utf-8")
        good_sig = hmac.new(b"wh_secret_xyz777", raw_body, hashlib.sha256).hexdigest()

        # Anonymous webhook call with wrong signature fails
        self.client.force_authenticate(user=None)
        bad_wh = self.client.post(
            "/api/v1/payments/razorpay/webhook/",
            data=raw_body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE="invalid_sig",
        )
        self.assertEqual(bad_wh.status_code, 400)

        # Valid webhook captures payment
        ok_wh = self.client.post(
            "/api/v1/payments/razorpay/webhook/",
            data=raw_body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=good_sig,
            HTTP_X_RAZORPAY_EVENT_ID="evt_test_002",
        )
        self.assertEqual(ok_wh.status_code, 200)

        # Replaying exact same webhook event is idempotent
        replay_wh = self.client.post(
            "/api/v1/payments/razorpay/webhook/",
            data=raw_body,
            content_type="application/json",
            HTTP_X_RAZORPAY_SIGNATURE=good_sig,
            HTTP_X_RAZORPAY_EVENT_ID="evt_test_002",
        )
        self.assertEqual(replay_wh.status_code, 200)

        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.payment_status, Order.PaymentStatus.PAID)
        self.assertEqual(order.overall_status, Order.OverallStatus.CONFIRMED)
        self.assertEqual(
            PaymentTransaction.objects.filter(
                event_type="WEBHOOK_PAYMENT_CAPTURED"
            ).count(),
            1,
        )

    def test_seller_suborder_isolation_transitions_and_buyer_cancel_restock(self):
        """Sellers only see/update their own suborders; buyers can cancel before packing & restore stock."""
        self._add_to_cart(self.variant_a, quantity=1)
        self._add_to_cart(self.variant_b, quantity=1)
        checkout_res = self.client.post(
            "/api/v1/checkout/",
            {"address_id": str(self.address.id), "payment_method": "COD"},
            format="json",
        )
        self.assertEqual(checkout_res.status_code, 201)
        order_id = checkout_res.data["order"]["id"]
        suborders = SellerSuborder.objects.filter(parent_order_id=order_id)
        sub_a = suborders.get(seller=self.seller_a)
        sub_b = suborders.get(seller=self.seller_b)

        # Seller A sees ONLY sub_a
        self.client.force_authenticate(user=self.seller_user_a)
        list_a = self.client.get("/api/v1/seller/suborders/")
        self.assertEqual(list_a.status_code, 200)
        self.assertEqual(list_a.data["count"], 1)
        self.assertEqual(list_a.data["results"][0]["id"], str(sub_a.id))

        # Seller A cannot touch Seller B's suborder (strict ownership isolation)
        cross_patch = self.client.patch(
            f"/api/v1/seller/suborders/{sub_b.id}/status/",
            {"status": "ACCEPTED"},
            format="json",
        )
        self.assertEqual(cross_patch.status_code, 400)

        # Seller A accepts their own suborder
        accept_res = self.client.patch(
            f"/api/v1/seller/suborders/{sub_a.id}/status/",
            {"status": "ACCEPTED", "seller_notes": "Glazing & bubble-wrapping today"},
            format="json",
        )
        self.assertEqual(accept_res.status_code, 200)
        self.assertEqual(accept_res.data["suborder"]["fulfilment_status"], "ACCEPTED")

        # Admin sees live order KPIs and full order/payment tables
        self.client.force_authenticate(user=self.admin)
        admin_dash = self.client.get("/api/v1/admin/dashboard/")
        self.assertEqual(admin_dash.status_code, 200)
        self.assertEqual(admin_dash.data["kpis"]["total_orders"], 1)
        self.assertEqual(Decimal(admin_dash.data["kpis"]["total_revenue"]), Decimal("2000.00"))
        self.assertEqual(len(admin_dash.data["sales_series"]), 6)

        admin_orders = self.client.get("/api/v1/admin/orders/")
        self.assertEqual(admin_orders.status_code, 200)
        self.assertEqual(admin_orders.data["count"], 1)

        admin_payments = self.client.get("/api/v1/admin/payments/")
        self.assertEqual(admin_payments.status_code, 200)
        self.assertEqual(admin_payments.data["count"], 1)

        # Buyer cancels order before either studio packs → stock restored to original counts
        self.client.force_authenticate(user=self.buyer)
        cancel_res = self.client.post(f"/api/v1/buyer/orders/{order_id}/cancel/")
        self.assertEqual(cancel_res.status_code, 200)
        self.assertEqual(cancel_res.data["order"]["overall_status"], "CANCELLED")
        self.inv_a.refresh_from_db()
        self.inv_b.refresh_from_db()
        self.assertEqual(self.inv_a.quantity_available, 4)
        self.assertEqual(self.inv_b.quantity_available, 5)
