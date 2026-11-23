"""Week 11 Automated Tests: Verified Reviews, In-App Notifications & Real DB Analytics."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.catalog.models import Category, Inventory, Product, ProductVariant
from apps.commerce.models import BuyerAddress
from apps.notifications.models import Notification
from apps.sellers.models import SellerProfile

User = get_user_model()


class ReviewsNotificationsAnalyticsTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = User.objects.create_user(
            username="rev_admin",
            email="rev_admin@craftify.in",
            password="StrongPassword!123",
            role=User.Role.ADMIN,
            is_email_verified=True,
            is_staff=True,
        )
        self.buyer = User.objects.create_user(
            username="rev_buyer",
            email="rev_buyer@craftify.in",
            password="StrongPassword!123",
            role=User.Role.BUYER,
            is_email_verified=True,
            full_name="Meera Nair",
        )
        self.other_buyer = User.objects.create_user(
            username="rev_buyer_two",
            email="rev_buyer2@craftify.in",
            password="StrongPassword!123",
            role=User.Role.BUYER,
            is_email_verified=True,
        )
        self.seller_user = User.objects.create_user(
            username="rev_seller",
            email="rev_seller@craftify.in",
            password="StrongPassword!123",
            role=User.Role.SELLER,
            is_email_verified=True,
        )
        self.other_seller_user = User.objects.create_user(
            username="rev_seller_two",
            email="rev_seller2@craftify.in",
            password="StrongPassword!123",
            role=User.Role.SELLER,
            is_email_verified=True,
        )

        self.seller_profile = SellerProfile.objects.create(
            user=self.seller_user,
            shop_name="Moradabad Brass Atelier",
            slug="moradabad-brass-atelier",
            city="Moradabad",
            state="Uttar Pradesh",
            pickup_address_json={"line1": "22 Brass Lane", "city": "Moradabad", "pincode": "244001"},
            bank_account_masked="XXXX-XXXX-2211",
            ifsc_code="SBIN0005678",
        )
        self.other_seller_profile = SellerProfile.objects.create(
            user=self.other_seller_user,
            shop_name="Bastar Bell Metal",
            slug="bastar-bell-metal",
            city="Jagdalpur",
            state="Chhattisgarh",
            pickup_address_json={"line1": "9 Craft Rd", "city": "Jagdalpur", "pincode": "494001"},
        )

        self.category = Category.objects.create(
            name="Brass & Metalwork",
            slug="brass-metalwork",
            commission_rate=Decimal("12.00"),
        )
        self.product = Product.objects.create(
            seller=self.seller_profile,
            category=self.category,
            title="Hand-Engraved Brass Diya Pair",
            slug="hand-engraved-brass-diya-pair",
            description="Traditional sand-cast brass lamps finished by hand.",
            base_price=Decimal("1400.00"),
            approval_status=Product.ApprovalStatus.APPROVED,
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            label="Antique Finish",
            sku="BRS-DIYA-01",
            price_override=Decimal("1400.00"),
        )
        Inventory.objects.create(
            variant=self.variant,
            quantity_available=8,
            quantity_reserved=0,
        )
        self.address = BuyerAddress.objects.create(
            user=self.buyer,
            label=BuyerAddress.AddressLabel.HOME,
            recipient_name="Meera Nair",
            phone="9876543210",
            line1="101 Indiranagar",
            city="Bengaluru",
            state="Karnataka",
            pincode="560038",
        )

    def _checkout_cod_order(self):
        self.client.force_authenticate(user=self.buyer)
        add_res = self.client.post(
            "/api/v1/cart/items/",
            {"variant_id": str(self.variant.id), "quantity": 1},
            format="json",
        )
        self.assertIn(add_res.status_code, (200, 201))
        chk = self.client.post(
            "/api/v1/checkout/",
            {"address_id": str(self.address.id), "payment_method": "COD"},
            format="json",
        )
        self.assertEqual(chk.status_code, 201)
        sub = chk.data["order"]["suborders"][0]
        return sub["id"], sub["items"][0]["id"]

    def _deliver_suborder(self, suborder_id):
        self.client.force_authenticate(user=self.seller_user)
        for st in ("ACCEPTED", "PACKED"):
            res = self.client.patch(
                f"/api/v1/seller/suborders/{suborder_id}/status/",
                {"status": st},
                format="json",
            )
            self.assertEqual(res.status_code, 200)
        ship = self.client.post(
            f"/api/v1/seller/suborders/{suborder_id}/ship/",
            {"courier_name": "Blue Dart", "tracking_number": "BLD12345678"},
            format="json",
        )
        self.assertEqual(ship.status_code, 201)
        deliv = self.client.post(
            f"/api/v1/seller/suborders/{suborder_id}/deliver/",
            {"delivery_notes": "Delivered to buyer"},
            format="json",
        )
        self.assertEqual(deliv.status_code, 200)

    def test_verified_review_requires_delivery_and_prevents_duplicates(self):
        sub_id, order_item_id = self._checkout_cod_order()

        # Before delivery -> blocked
        self.client.force_authenticate(user=self.buyer)
        early_res = self.client.post(
            "/api/v1/buyer/reviews/",
            {
                "order_item_id": order_item_id,
                "rating": 5,
                "title": "Premature review",
                "comment": "Should not be allowed before delivery.",
            },
            format="json",
        )
        self.assertEqual(early_res.status_code, 400)

        # Deliver suborder
        self._deliver_suborder(sub_id)

        # Buyer posts verified review
        self.client.force_authenticate(user=self.buyer)
        rev_res = self.client.post(
            "/api/v1/buyer/reviews/",
            {
                "order_item_id": order_item_id,
                "rating": 5,
                "title": "Exquisite engraving",
                "comment": "Heavy solid brass with crisp hand-engraved detail.",
            },
            format="json",
        )
        self.assertEqual(rev_res.status_code, 201)
        self.assertTrue(rev_res.data["review"]["is_verified_purchase"])

        # Duplicate review on same order_item blocked
        dup_res = self.client.post(
            "/api/v1/buyer/reviews/",
            {
                "order_item_id": order_item_id,
                "rating": 4,
                "comment": "Attempting to submit a duplicate review.",
            },
            format="json",
        )
        self.assertEqual(dup_res.status_code, 400)

        # SellerProfile.rating_avg updated and public PDP reviews endpoint reflects it
        self.seller_profile.refresh_from_db()
        self.assertEqual(self.seller_profile.rating_avg, Decimal("5.00"))

        self.client.force_authenticate(user=None)
        pub_res = self.client.get(f"/api/v1/products/{self.product.slug}/reviews/")
        self.assertEqual(pub_res.status_code, 200)
        self.assertEqual(pub_res.data["summary"]["rating_avg"], "5.00")
        self.assertEqual(pub_res.data["summary"]["review_count"], 1)

        # Seller received REVIEW notification
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.seller_user,
                category=Notification.Category.REVIEW,
            ).exists()
        )

    def test_seller_reply_and_cross_seller_isolation(self):
        sub_id, order_item_id = self._checkout_cod_order()
        self._deliver_suborder(sub_id)

        self.client.force_authenticate(user=self.buyer)
        rev = self.client.post(
            "/api/v1/buyer/reviews/",
            {
                "order_item_id": order_item_id,
                "rating": 4,
                "comment": "Lovely finish and very protective wooden packaging.",
            },
            format="json",
        ).data["review"]

        # Other seller blocked from replying to Seller 1's review
        self.client.force_authenticate(user=self.other_seller_user)
        bad_reply = self.client.post(
            f"/api/v1/seller/reviews/{rev['id']}/reply/",
            {"seller_reply": "Unauthorized studio reply"},
            format="json",
        )
        self.assertEqual(bad_reply.status_code, 400)

        # Owning seller posts reply -> Buyer notified
        self.client.force_authenticate(user=self.seller_user)
        ok_reply = self.client.post(
            f"/api/v1/seller/reviews/{rev['id']}/reply/",
            {"seller_reply": "Thank you Meera! Crafted with care in Moradabad."},
            format="json",
        )
        self.assertEqual(ok_reply.status_code, 200)
        self.assertIn("Moradabad", ok_reply.data["review"]["seller_reply"])
        self.assertTrue(
            Notification.objects.filter(
                recipient=self.buyer,
                category=Notification.Category.REVIEW,
            ).exists()
        )

    def test_admin_review_moderation_hides_and_recalculates_rating(self):
        sub_id, order_item_id = self._checkout_cod_order()
        self._deliver_suborder(sub_id)

        self.client.force_authenticate(user=self.buyer)
        rev_id = self.client.post(
            "/api/v1/buyer/reviews/",
            {
                "order_item_id": order_item_id,
                "rating": 5,
                "comment": "Authentic handcrafted diya pair, shines beautifully.",
            },
            format="json",
        ).data["review"]["id"]

        # Admin hides review -> rating_avg resets to 0.00 & public count drops to 0
        self.client.force_authenticate(user=self.admin)
        hide_res = self.client.post(
            f"/api/v1/admin/reviews/{rev_id}/moderate/",
            {"status": "HIDDEN", "moderation_notes": "Spam links detected"},
            format="json",
        )
        self.assertEqual(hide_res.status_code, 200)
        self.seller_profile.refresh_from_db()
        self.assertEqual(self.seller_profile.rating_avg, Decimal("0.00"))

        pub_hidden = self.client.get(f"/api/v1/products/{self.product.slug}/reviews/")
        self.assertEqual(pub_hidden.data["summary"]["review_count"], 0)

        # Admin restores review -> rating_avg restored to 5.00
        rest_res = self.client.post(
            f"/api/v1/admin/reviews/{rev_id}/moderate/",
            {"status": "PUBLISHED", "moderation_notes": "Verified genuine"},
            format="json",
        )
        self.assertEqual(rest_res.status_code, 200)
        self.seller_profile.refresh_from_db()
        self.assertEqual(self.seller_profile.rating_avg, Decimal("5.00"))

    def test_notifications_inbox_mark_read_and_isolation(self):
        sub_id, _ = self._checkout_cod_order()
        self._deliver_suborder(sub_id)

        # Buyer has unread shipping + delivery notifications
        self.client.force_authenticate(user=self.buyer)
        inbox = self.client.get("/api/v1/notifications/")
        self.assertEqual(inbox.status_code, 200)
        self.assertGreaterEqual(inbox.data["unread_count"], 2)
        first_id = inbox.data["results"][0]["id"]

        # Other buyer cannot mark Buyer 1's notification read
        self.client.force_authenticate(user=self.other_buyer)
        cross_res = self.client.post(f"/api/v1/notifications/{first_id}/read/")
        self.assertEqual(cross_res.status_code, 404)

        # Buyer marks one read, then marks all read
        self.client.force_authenticate(user=self.buyer)
        one_res = self.client.post(f"/api/v1/notifications/{first_id}/read/")
        self.assertEqual(one_res.status_code, 200)
        self.assertTrue(one_res.data["notification"]["is_read"])

        all_res = self.client.post("/api/v1/notifications/read-all/")
        self.assertEqual(all_res.status_code, 200)
        self.assertEqual(all_res.data["unread_count"], 0)

    def test_real_db_analytics_endpoints_for_admin_and_seller(self):
        sub_id, order_item_id = self._checkout_cod_order()
        self._deliver_suborder(sub_id)

        self.client.force_authenticate(user=self.buyer)
        self.client.post(
            "/api/v1/buyer/reviews/",
            {
                "order_item_id": order_item_id,
                "rating": 5,
                "comment": "Wonderful brass craftsmanship, highly recommended!",
            },
            format="json",
        )

        # Buyer is forbidden from Seller & Admin analytics
        self.assertEqual(self.client.get("/api/v1/seller/analytics/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/admin/analytics/").status_code, 403)

        # Seller analytics returns real monthly earnings, top product & 5.00 rating
        self.client.force_authenticate(user=self.seller_user)
        s_res = self.client.get("/api/v1/seller/analytics/")
        self.assertEqual(s_res.status_code, 200)
        self.assertEqual(len(s_res.data["monthly_earnings"]), 6)
        self.assertEqual(s_res.data["rating_avg"], "5.00")
        self.assertEqual(s_res.data["top_products"][0]["units_sold"], 1)

        # Admin analytics returns real platform breakdown & quality metrics
        self.client.force_authenticate(user=self.admin)
        a_res = self.client.get("/api/v1/admin/analytics/")
        self.assertEqual(a_res.status_code, 200)
        self.assertEqual(len(a_res.data["monthly_performance"]), 6)
        self.assertEqual(a_res.data["category_breakdown"][0]["category"], "Brass & Metalwork")
        self.assertEqual(a_res.data["quality_metrics"]["platform_rating_avg"], "5.00")
        self.assertEqual(a_res.data["quality_metrics"]["total_published_reviews"], 1)
