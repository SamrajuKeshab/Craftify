"""Automated Week 5 tests for Categories, Commissions, Seller Products, Cloudinary & Moderation."""
import io
import json
from unittest.mock import patch

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.catalog.models import Category, Product, ProductImage
from apps.sellers.models import SellerProfile


def _make_test_png(name: str = "craft.png") -> SimpleUploadedFile:
    buf = io.BytesIO()
    img = Image.new("RGB", (64, 64), color=(139, 75, 40))
    img.save(buf, format="PNG")
    buf.seek(0)
    return SimpleUploadedFile(name, buf.read(), content_type="image/png")


class CraftifyCatalogAndModerationTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(
            username="catalog_admin",
            email="catadmin@craftify.in",
            full_name="Catalog Admin",
            password="AdminStrongPassword@2026",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
            is_email_verified=True,
        )
        self.buyer = User.objects.create_user(
            username="catalog_buyer",
            email="catbuyer@craftify.in",
            full_name="Aarav Buyer",
            password="BuyerStrongPassword@2026",
            role=User.Role.BUYER,
            is_email_verified=True,
        )
        self.seller_user_1 = User.objects.create_user(
            username="studio_one",
            email="studio1@craftify.in",
            full_name="Meera Studio",
            password="SellerStrongPassword@2026",
            role=User.Role.SELLER,
            is_email_verified=True,
        )
        self.seller_profile_1 = SellerProfile.objects.create(
            user=self.seller_user_1,
            shop_name="Jaipur Clay Works",
            slug="jaipur-clay-works",
            primary_category="Pottery",
            city="Jaipur",
            state="Rajasthan",
        )
        self.seller_user_2 = User.objects.create_user(
            username="studio_two",
            email="studio2@craftify.in",
            full_name="Kabir Looms",
            password="SellerStrongPassword@2026",
            role=User.Role.SELLER,
            is_email_verified=True,
        )
        self.seller_profile_2 = SellerProfile.objects.create(
            user=self.seller_user_2,
            shop_name="Kutch Weave House",
            slug="kutch-weave-house",
            primary_category="Textiles",
            city="Bhuj",
            state="Gujarat",
        )

    def test_starts_with_zero_categories_and_admin_creates_with_commission_bounds(self):
        # Starts cleanly with zero pre-seeded categories
        public_res = self.client.get("/api/v1/categories/")
        self.assertEqual(public_res.status_code, status.HTTP_200_OK)
        self.assertEqual(public_res.data["count"], 0)

        # Non-admin blocked from creating category
        self.client.force_authenticate(user=self.seller_user_1)
        denied = self.client.post(
            "/api/v1/admin/categories/",
            {"name": "Pottery", "commission_rate": "10.00"},
            format="json",
        )
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        # Admin rejected if commission_rate > 50%
        self.client.force_authenticate(user=self.admin)
        invalid = self.client.post(
            "/api/v1/admin/categories/",
            {"name": "Pottery", "commission_rate": "65.00"},
            format="json",
        )
        self.assertEqual(invalid.status_code, status.HTTP_400_BAD_REQUEST)

        # Admin creates valid category
        created = self.client.post(
            "/api/v1/admin/categories/",
            {
                "name": "Blue Pottery",
                "commission_rate": "12.50",
                "description": "Hand-painted ceramic vessels from Jaipur.",
            },
            format="json",
        )
        self.assertEqual(created.status_code, status.HTTP_201_CREATED)
        self.assertEqual(created.data["category"]["commission_rate"], "12.50")
        self.assertTrue(AuditLog.objects.filter(action="CATEGORY_CREATED").exists())

    @patch("apps.catalog.services.upload_image_to_cloudinary")
    def test_seller_creates_product_with_cloudinary_image_and_hidden_until_admin_approves(
        self, mock_upload
    ):
        mock_upload.return_value = {
            "image_url": "https://res.cloudinary.com/demo/image/upload/v1/craftify/products/vase.png",
            "cloudinary_public_id": "craftify/products/vase_123",
        }
        cat = Category.objects.create(
            name="Pottery & Ceramics",
            slug="pottery-ceramics",
            commission_rate="10.00",
        )

        self.client.force_authenticate(user=self.seller_user_1)
        payload = {
            "category": str(cat.id),
            "title": "Hand-Painted Blue Pottery Vase",
            "description": "Wheel-thrown ceramic vase finished with natural cobalt glaze.",
            "base_price": "1499.00",
            "discount_price": "1299.00",
            "processing_days": 4,
            "is_one_of_a_kind": "true",
            "variants": json.dumps(
                [
                    {
                        "label": "Medium (8 inch)",
                        "sku": "JP-VASE-001",
                        "quantity_available": 6,
                        "dimensions_cm": "20x12x12",
                    }
                ]
            ),
            "images": [_make_test_png("vase.png")],
        }
        res = self.client.post("/api/v1/seller/products/", payload, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        product_id = res.data["product"]["id"]
        self.assertEqual(res.data["product"]["approval_status"], "PENDING")
        self.assertEqual(res.data["product"]["effective_price"], "1299.00")
        self.assertEqual(res.data["product"]["total_stock"], 6)
        self.assertEqual(len(res.data["product"]["images"]), 1)
        mock_upload.assert_called_once()

        # Pending product must NOT appear on public Storefront yet
        self.client.force_authenticate(user=None)
        public_before = self.client.get("/api/v1/products/")
        self.assertEqual(public_before.data["count"], 0)

        # Admin Dashboard reflects 1 pending product approval
        self.client.force_authenticate(user=self.admin)
        dash = self.client.get("/api/v1/admin/dashboard/")
        self.assertEqual(dash.data["pending_approvals"]["product_approvals"], 1)

        # Admin approves product -> immediately visible on public Storefront
        mod = self.client.post(
            f"/api/v1/admin/products/{product_id}/moderate/",
            {"action": "APPROVE", "review_notes": "Authentic handmade studio listing."},
            format="json",
        )
        self.assertEqual(mod.status_code, status.HTTP_200_OK)
        self.assertEqual(mod.data["product"]["approval_status"], "APPROVED")
        self.assertTrue(AuditLog.objects.filter(action="PRODUCT_APPROVED").exists())

        self.client.force_authenticate(user=None)
        public_after = self.client.get("/api/v1/products/")
        self.assertEqual(public_after.data["count"], 1)
        self.assertEqual(
            public_after.data["results"][0]["title"], "Hand-Painted Blue Pottery Vase"
        )

    def test_seller_ownership_isolation_and_suspended_seller_blocked(self):
        cat = Category.objects.create(name="Woodcraft", slug="woodcraft", commission_rate="10.00")
        self.client.force_authenticate(user=self.seller_user_1)
        create_res = self.client.post(
            "/api/v1/seller/products/",
            {
                "category": str(cat.id),
                "title": "Carved Teak Serving Tray",
                "description": "Hand-carved reclaimed teak wood serving tray finished with beeswax.",
                "base_price": "1850.00",
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        product_id = create_res.data["product"]["id"]

        # Seller 2 cannot view, edit, or delete Seller 1's product
        self.client.force_authenticate(user=self.seller_user_2)
        self.assertEqual(
            self.client.get(f"/api/v1/seller/products/{product_id}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.patch(
                f"/api/v1/seller/products/{product_id}/", {"title": "Hijacked"}, format="json"
            ).status_code,
            status.HTTP_404_NOT_FOUND,
        )
        self.assertEqual(
            self.client.delete(f"/api/v1/seller/products/{product_id}/").status_code,
            status.HTTP_404_NOT_FOUND,
        )

        # Suspended seller is blocked from adding products
        self.seller_profile_2.is_suspended = True
        self.seller_profile_2.save()
        blocked = self.client.post(
            "/api/v1/seller/products/",
            {
                "category": str(cat.id),
                "title": "Blocked Shawl Listing",
                "description": "Handloom wool shawl woven on traditional pit looms in Bhuj.",
                "base_price": "2400.00",
            },
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)

    @patch("apps.catalog.services.delete_cloudinary_asset")
    @patch("apps.catalog.services.upload_image_to_cloudinary")
    def test_admin_rejection_requires_reason_resubmit_and_image_delete_cleanup(
        self, mock_upload, mock_delete
    ):
        mock_upload.return_value = {
            "image_url": "https://res.cloudinary.com/demo/image/upload/v1/craftify/products/lamp.png",
            "cloudinary_public_id": "craftify/products/lamp_999",
        }
        cat = Category.objects.create(name="Home Decor", slug="home-decor", commission_rate="12.00")

        self.client.force_authenticate(user=self.seller_user_1)
        res = self.client.post(
            "/api/v1/seller/products/",
            {
                "category": str(cat.id),
                "title": "Terracotta Table Lamp",
                "description": "Warm carved clay table lamp handcrafted by Rajasthani artisans.",
                "base_price": "2200.00",
                "images": [_make_test_png("lamp.png")],
            },
            format="multipart",
        )
        product_id = res.data["product"]["id"]
        image_id = res.data["product"]["images"][0]["id"]

        # Admin rejection without review notes fails validation
        self.client.force_authenticate(user=self.admin)
        bad_reject = self.client.post(
            f"/api/v1/admin/products/{product_id}/moderate/",
            {"action": "REJECT", "review_notes": ""},
            format="json",
        )
        self.assertEqual(bad_reject.status_code, status.HTTP_400_BAD_REQUEST)

        # Rejection with reason succeeds
        good_reject = self.client.post(
            f"/api/v1/admin/products/{product_id}/moderate/",
            {"action": "REJECT", "review_notes": "Please add lamp dimensions."},
            format="json",
        )
        self.assertEqual(good_reject.status_code, status.HTTP_200_OK)
        self.assertEqual(good_reject.data["product"]["approval_status"], "REJECTED")

        # Seller edits rejected listing -> automatically resets to PENDING for re-review
        self.client.force_authenticate(user=self.seller_user_1)
        resubmitted = self.client.patch(
            f"/api/v1/seller/products/{product_id}/",
            {"description": "Warm carved clay table lamp (Height 30cm, Width 18cm) handcrafted in Jaipur."},
            format="json",
        )
        self.assertEqual(resubmitted.status_code, status.HTTP_200_OK)
        self.assertEqual(resubmitted.data["product"]["approval_status"], "PENDING")

        # Deleting product image triggers Cloudinary cleanup
        del_img = self.client.delete(
            f"/api/v1/seller/products/{product_id}/images/{image_id}/"
        )
        self.assertEqual(del_img.status_code, status.HTTP_200_OK)
        self.assertEqual(ProductImage.objects.filter(product_id=product_id).count(), 0)
        mock_delete.assert_called_once_with("craftify/products/lamp_999")

        # Soft deleting product removes it from active catalog without hard-deleting row
        del_prod = self.client.delete(f"/api/v1/seller/products/{product_id}/")
        self.assertEqual(del_prod.status_code, status.HTTP_200_OK)
        self.assertTrue(Product.objects.get(pk=product_id).is_deleted)
