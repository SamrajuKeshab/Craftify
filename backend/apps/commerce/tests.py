"""Week 7 automated tests for Buyer Addresses, Persistent Cart, Wishlist, and Admin Coupons."""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.catalog.models import Category, Inventory, Product, ProductVariant
from apps.commerce.models import BuyerAddress, Coupon
from apps.sellers.models import SellerProfile

User = get_user_model()


class Week7CommerceAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="admin_w7",
            email="admin_w7@craftify.in",
            full_name="Craftify Admin",
            password="StrongPassword@2026",
            role="ADMIN",
            is_email_verified=True,
        )
        self.buyer = User.objects.create_user(
            username="buyer_w7",
            email="buyer_w7@craftify.in",
            full_name="Ananya Iyer",
            password="StrongPassword@2026",
            role="BUYER",
            is_email_verified=True,
        )
        self.other_buyer = User.objects.create_user(
            username="buyer2_w7",
            email="buyer2_w7@craftify.in",
            full_name="Rohan Verma",
            password="StrongPassword@2026",
            role="BUYER",
            is_email_verified=True,
        )
        self.seller_user = User.objects.create_user(
            username="seller_w7",
            email="seller_w7@craftify.in",
            full_name="Meera Crafts",
            password="StrongPassword@2026",
            role="SELLER",
            is_email_verified=True,
        )
        self.seller_profile = SellerProfile.objects.create(
            user=self.seller_user,
            shop_name="Jaipur Clay Studio",
            slug="jaipur-clay-studio",
            primary_category="Pottery & Ceramics",
            description="Handmade stoneware pottery from Jaipur.",
            pickup_address="12 Johari Bazaar, Jaipur",
            city="Jaipur",
            state="Rajasthan",
            pincode="302003",
        )
        self.category = Category.objects.create(
            name="Pottery & Ceramics",
            slug="pottery-ceramics",
            commission_rate=Decimal("10.00"),
            is_active=True,
        )
        self.product = Product.objects.create(
            seller=self.seller_profile,
            category=self.category,
            title="Hand-Painted Terracotta Vase",
            slug="hand-painted-terracotta-vase",
            description="Wheel-thrown terracotta vase finished with natural mineral pigments.",
            base_price=Decimal("800.00"),
            discount_price=Decimal("600.00"),
            processing_days=3,
            is_customizable=True,
            approval_status=Product.ApprovalStatus.APPROVED,
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            sku="JCS-VASE-STD",
            label="Medium (10 inch)",
            is_active=True,
        )
        Inventory.objects.create(variant=self.variant, quantity_available=3)

    def test_guest_cannot_access_cart_wishlist_or_addresses(self):
        self.assertEqual(
            self.client.get("/api/v1/cart/").status_code, status.HTTP_401_UNAUTHORIZED
        )
        self.assertEqual(
            self.client.post(
                "/api/v1/cart/items/", {"variant_id": str(self.variant.id), "quantity": 1}
            ).status_code,
            status.HTTP_401_UNAUTHORIZED,
        )
        self.assertEqual(
            self.client.get("/api/v1/wishlist/").status_code, status.HTTP_401_UNAUTHORIZED
        )
        self.assertEqual(
            self.client.get("/api/v1/buyer/addresses/").status_code,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_buyer_address_crud_and_ownership_isolation(self):
        self.client.force_authenticate(user=self.buyer)
        res = self.client.post(
            "/api/v1/buyer/addresses/",
            {
                "label": "HOME",
                "recipient_name": "Ananya Iyer",
                "phone": "+91 98765 43210",
                "line1": "42 Indiranagar 100ft Road",
                "city": "Bengaluru",
                "state": "Karnataka",
                "pincode": "560038",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        addr_id = res.data["address"]["id"]
        self.assertTrue(res.data["address"]["is_default"])
        self.assertEqual(res.data["address"]["phone"], "9876543210")

        # Another buyer cannot modify or delete this address
        self.client.force_authenticate(user=self.other_buyer)
        forbidden_del = self.client.delete(f"/api/v1/buyer/addresses/{addr_id}/")
        self.assertEqual(forbidden_del.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(BuyerAddress.objects.filter(pk=addr_id).exists())

    def test_persistent_cart_stock_guard_and_admin_coupon_application(self):
        # Buyer cannot create coupons
        self.client.force_authenticate(user=self.buyer)
        now = timezone.now()
        buyer_coupon_attempt = self.client.post(
            "/api/v1/admin/coupons/",
            {
                "code": "HACK50",
                "discount_type": "PERCENT",
                "value": "50.00",
                "min_order_amount": "0.00",
                "valid_from": (now - timedelta(hours=1)).isoformat(),
                "valid_until": (now + timedelta(days=7)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(buyer_coupon_attempt.status_code, status.HTTP_403_FORBIDDEN)

        # Admin creates a valid platform coupon
        self.client.force_authenticate(user=self.admin)
        create_res = self.client.post(
            "/api/v1/admin/coupons/",
            {
                "code": "DIWALI10",
                "description": "10% off on orders ₹1,000+",
                "discount_type": "PERCENT",
                "value": "10.00",
                "min_order_amount": "1000.00",
                "max_discount_amount": "300.00",
                "valid_from": (now - timedelta(hours=1)).isoformat(),
                "valid_until": (now + timedelta(days=10)).isoformat(),
                "max_uses": 100,
                "per_user_limit": 1,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Coupon.objects.filter(code="DIWALI10").exists())

        # Buyer adds 1 unit (₹600 -> below ₹999 free shipping, shipping=₹79)
        self.client.force_authenticate(user=self.buyer)
        add_res = self.client.post(
            "/api/v1/cart/items/",
            {
                "variant_id": str(self.variant.id),
                "quantity": 1,
                "customization_note": "Gift wrap with note",
            },
            format="json",
        )
        self.assertEqual(add_res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(add_res.data["cart"]["subtotal"], "600.00")
        self.assertEqual(add_res.data["cart"]["shipping"], "79.00")
        self.assertEqual(add_res.data["cart"]["total"], "679.00")

        # Coupon fails because subtotal ₹600 < ₹1,000
        fail_coupon = self.client.post(
            "/api/v1/cart/apply-coupon/", {"code": "DIWALI10"}, format="json"
        )
        self.assertEqual(fail_coupon.status_code, status.HTTP_400_BAD_REQUEST)

        # Exceeding stock (3 available) is blocked
        item_id = add_res.data["cart"]["items"][0]["id"]
        over_stock = self.client.patch(
            f"/api/v1/cart/items/{item_id}/", {"quantity": 5}, format="json"
        )
        self.assertEqual(over_stock.status_code, status.HTTP_400_BAD_REQUEST)

        # Updating to 2 units (₹1,200) unlocks free shipping and DIWALI10 (₹120 off -> ₹1,080)
        upd_res = self.client.patch(
            f"/api/v1/cart/items/{item_id}/", {"quantity": 2}, format="json"
        )
        self.assertEqual(upd_res.status_code, status.HTTP_200_OK)
        self.assertEqual(upd_res.data["cart"]["shipping"], "0.00")

        apply_res = self.client.post(
            "/api/v1/cart/apply-coupon/", {"code": "diwali10"}, format="json"
        )
        self.assertEqual(apply_res.status_code, status.HTTP_200_OK)
        self.assertEqual(apply_res.data["cart"]["discount"], "120.00")
        self.assertEqual(apply_res.data["cart"]["total"], "1080.00")

    def test_wishlist_toggle_and_move_to_cart(self):
        self.client.force_authenticate(user=self.buyer)
        toggle_add = self.client.post(
            "/api/v1/wishlist/toggle/",
            {"product_id": str(self.product.id)},
            format="json",
        )
        self.assertEqual(toggle_add.status_code, status.HTTP_201_CREATED)
        self.assertEqual(toggle_add.data["count"], 1)

        move_res = self.client.post(
            f"/api/v1/wishlist/{self.product.id}/move-to-cart/", {}, format="json"
        )
        self.assertEqual(move_res.status_code, status.HTTP_200_OK)
        self.assertEqual(move_res.data["wishlist"]["count"], 0)
        self.assertEqual(move_res.data["cart"]["item_count"], 1)
