"""Automated Week 4 tests for Seller Onboarding, Admin Approvals, RBAC, and Audit Logs."""
import tempfile

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.sellers.models import (
    SellerApplication,
    SellerProfile,
    SellerVerificationDocument,
)


@override_settings(MEDIA_ROOT=tempfile.mkdtemp(prefix="craftify_test_media_"))
class CraftifySellerOnboardingAndAdminTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(
            username="craftify_admin",
            email="admin@craftify.in",
            full_name="Craftify Admin",
            password="AdminStrongPassword@2026",
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
            is_email_verified=True,
        )
        self.buyer = User.objects.create_user(
            username="artisan_buyer",
            email="artisan@craftify.in",
            full_name="Meera Nair",
            password="BuyerStrongPassword@2026",
            role=User.Role.BUYER,
            is_email_verified=True,
        )
        self.unverified_buyer = User.objects.create_user(
            username="unverified_buyer",
            email="unverified@craftify.in",
            full_name="Ravi Verma",
            password="BuyerStrongPassword@2026",
            role=User.Role.BUYER,
            is_email_verified=False,
        )
        self.valid_application_payload = {
            "shop_name": "Terracotta Loom Studio",
            "primary_category": "Pottery & Ceramics",
            "bio": "Hand-thrown blue pottery and terracotta homeware crafted in Jaipur.",
            "pickup_address": "14 Johari Bazar Lane, Old City",
            "city": "Jaipur",
            "state": "Rajasthan",
            "pincode": "302003",
            "pan_number": "ABCDE1234F",
            "gstin": "08ABCDE1234F1Z5",
            "bank_account_number": "123456789012",
            "ifsc_code": "SBIN0001234",
            "accepted_agreement": "true",
            "doc_type": "PAN_CARD",
        }

    def test_unverified_buyer_cannot_submit_seller_application(self):
        self.client.force_authenticate(user=self.unverified_buyer)
        res = self.client.post(
            "/api/v1/sellers/apply/",
            self.valid_application_payload,
            format="multipart",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(SellerApplication.objects.count(), 0)

    def test_verified_buyer_applies_with_document_and_duplicate_pending_is_blocked(self):
        self.client.force_authenticate(user=self.buyer)
        sample_pdf = SimpleUploadedFile(
            "pan_card.pdf",
            b"%PDF-1.4 craftify test document",
            content_type="application/pdf",
        )
        payload = {**self.valid_application_payload, "document_file": sample_pdf}
        res = self.client.post("/api/v1/sellers/apply/", payload, format="multipart")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["application"]["status"], "PENDING")
        self.assertEqual(res.data["application"]["bank_account_masked"], "XXXXXXXX9012")
        self.assertEqual(len(res.data["application"]["documents"]), 1)

        # Duplicate pending application is rejected with 409 Conflict
        dup = self.client.post(
            "/api/v1/sellers/apply/",
            self.valid_application_payload,
            format="multipart",
        )
        self.assertEqual(dup.status_code, status.HTTP_409_CONFLICT)

        # Applicant can inspect their own status
        status_res = self.client.get("/api/v1/sellers/application-status/")
        self.assertEqual(status_res.status_code, status.HTTP_200_OK)
        self.assertEqual(status_res.data["application"]["shop_name"], "Terracotta Loom Studio")

    def test_non_admin_blocked_from_admin_endpoints(self):
        self.client.force_authenticate(user=self.buyer)
        for url in [
            "/api/v1/admin/dashboard/",
            "/api/v1/admin/seller-applications/",
            "/api/v1/admin/sellers/",
            "/api/v1/admin/buyers/",
            "/api/v1/admin/audit-logs/",
        ]:
            res = self.client.get(url)
            self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_approval_promotes_buyer_to_seller_and_creates_profile_and_audit_log(self):
        self.client.force_authenticate(user=self.buyer)
        apply_res = self.client.post(
            "/api/v1/sellers/apply/",
            self.valid_application_payload,
            format="multipart",
        )
        app_id = apply_res.data["application"]["id"]

        # Admin sees the pending application on dashboard & queue
        self.client.force_authenticate(user=self.admin)
        dash = self.client.get("/api/v1/admin/dashboard/")
        self.assertEqual(dash.status_code, status.HTTP_200_OK)
        self.assertEqual(dash.data["pending_approvals"]["seller_applications"], 1)
        self.assertEqual(dash.data["kpis"]["total_buyers"], 2)

        # Admin approves the application
        approve = self.client.post(
            f"/api/v1/admin/seller-applications/{app_id}/review/",
            {"action": "APPROVE", "review_notes": "Verified PAN and artisan craft story."},
            format="json",
        )
        self.assertEqual(approve.status_code, status.HTTP_200_OK)
        self.assertEqual(approve.data["application"]["status"], "APPROVED")

        self.buyer.refresh_from_db()
        self.assertEqual(self.buyer.role, User.Role.SELLER)
        self.assertEqual(self.buyer.get_dashboard_redirect_url(), "/seller/dashboard")

        profile = SellerProfile.objects.get(user=self.buyer)
        self.assertEqual(profile.shop_name, "Terracotta Loom Studio")
        self.assertTrue(
            AuditLog.objects.filter(action="SELLER_APPLICATION_APPROVED").exists()
        )

        # Approved seller can fetch and update own shop profile (but cannot touch is_suspended)
        self.client.force_authenticate(user=self.buyer)
        patch_res = self.client.patch(
            "/api/v1/sellers/shop/",
            {
                "description": "Updated studio description for Jaipur ceramics.",
                "is_suspended": True,
            },
            format="json",
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(
            patch_res.data["description"],
            "Updated studio description for Jaipur ceramics.",
        )
        self.assertFalse(patch_res.data["is_suspended"])

    def test_admin_rejection_requires_reason_and_allows_reapplication(self):
        self.client.force_authenticate(user=self.buyer)
        apply_res = self.client.post(
            "/api/v1/sellers/apply/",
            self.valid_application_payload,
            format="multipart",
        )
        app_id = apply_res.data["application"]["id"]

        self.client.force_authenticate(user=self.admin)
        # Missing review_notes must fail validation
        bad_reject = self.client.post(
            f"/api/v1/admin/seller-applications/{app_id}/review/",
            {"action": "REJECT", "review_notes": ""},
            format="json",
        )
        self.assertEqual(bad_reject.status_code, status.HTTP_400_BAD_REQUEST)

        # Rejection with clear notes succeeds
        good_reject = self.client.post(
            f"/api/v1/admin/seller-applications/{app_id}/review/",
            {"action": "REJECT", "review_notes": "Please upload a clearer PAN scan."},
            format="json",
        )
        self.assertEqual(good_reject.status_code, status.HTTP_200_OK)
        self.buyer.refresh_from_db()
        self.assertEqual(self.buyer.role, User.Role.BUYER)

        # Buyer can submit a revised application after rejection
        self.client.force_authenticate(user=self.buyer)
        reapply = self.client.post(
            "/api/v1/sellers/apply/",
            self.valid_application_payload,
            format="multipart",
        )
        self.assertEqual(reapply.status_code, status.HTTP_201_CREATED)

    def test_document_download_rbac_and_seller_suspension_flow(self):
        self.client.force_authenticate(user=self.buyer)
        sample_img = SimpleUploadedFile(
            "id_proof.png",
            b"\x89PNG\r\n\x1a\n craftify image bytes",
            content_type="image/png",
        )
        res = self.client.post(
            "/api/v1/sellers/apply/",
            {**self.valid_application_payload, "document_file": sample_img},
            format="multipart",
        )
        doc_id = res.data["application"]["documents"][0]["id"]
        app_id = res.data["application"]["id"]

        # Unrelated buyer is blocked from downloading applicant's KYC document
        self.client.force_authenticate(user=self.unverified_buyer)
        denied = self.client.get(f"/api/v1/sellers/documents/{doc_id}/")
        self.assertEqual(denied.status_code, status.HTTP_403_FORBIDDEN)

        # Admin can download the document and approve + suspend the seller
        self.client.force_authenticate(user=self.admin)
        allowed = self.client.get(f"/api/v1/sellers/documents/{doc_id}/")
        self.assertEqual(allowed.status_code, status.HTTP_200_OK)
        self.assertEqual(allowed["X-Content-Type-Options"], "nosniff")
        self.assertTrue(allowed.content.startswith(b"\x89PNG"))

        self.client.post(
            f"/api/v1/admin/seller-applications/{app_id}/review/",
            {"action": "APPROVE"},
            format="json",
        )
        profile = SellerProfile.objects.get(user=self.buyer)
        susp = self.client.post(
            f"/api/v1/admin/sellers/{profile.id}/toggle-suspend/",
            {"reason": "Quality audit hold"},
            format="json",
        )
        self.assertEqual(susp.status_code, status.HTTP_200_OK)
        self.assertTrue(susp.data["seller"]["is_suspended"])
        self.assertTrue(
            SellerVerificationDocument.objects.filter(id=doc_id, verified_at__isnull=False).exists()
        )
