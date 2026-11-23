"""Week 9 automated tests: Courier Dispatch, Tracking Events, Delivery Capture & 7-Day Returns."""
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.catalog.models import Category, Inventory, InventoryTransaction, Product, ProductVariant
from apps.commerce.models import BuyerAddress
from apps.orders.models import Order, Payment, SellerSuborder
from apps.sellers.models import SellerProfile
from apps.shipping.models import ReturnRequest, Shipment, ShipmentEvent

User = get_user_model()


class ShippingAndReturnsTestCase(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="ship_admin",
            email="ship_admin@craftify.in",
            password="StrongPassword!123",
            full_name="Shipping Admin",
            role=User.Role.ADMIN,
            is_staff=True,
            is_email_verified=True,
        )
        self.buyer = User.objects.create_user(
            username="ship_buyer",
            email="ship_buyer@craftify.in",
            password="StrongPassword!123",
            full_name="Ananya Nair",
            role=User.Role.BUYER,
            is_email_verified=True,
        )
        self.seller_user = User.objects.create_user(
            username="ship_seller",
            email="ship_seller@craftify.in",
            password="StrongPassword!123",
            full_name="Kabir Pottery",
            role=User.Role.SELLER,
            is_email_verified=True,
        )
        self.other_seller_user = User.objects.create_user(
            username="other_ship_seller",
            email="other_ship_seller@craftify.in",
            password="StrongPassword!123",
            full_name="Vikram Woodcraft",
            role=User.Role.SELLER,
            is_email_verified=True,
        )

        self.seller = SellerProfile.objects.create(
            user=self.seller_user,
            shop_name="Kochi Clay Studio",
            slug="kochi-clay-studio",
            primary_category="Pottery",
            city="Kochi",
            state="Kerala",
            pickup_address_json={
                "line1": "21 Fort Kochi Lane",
                "city": "Kochi",
                "state": "Kerala",
                "pincode": "682001",
            },
        )
        self.other_seller = SellerProfile.objects.create(
            user=self.other_seller_user,
            shop_name="Mysore Teak Works",
            slug="mysore-teak-works",
            primary_category="Woodcraft",
            city="Mysuru",
            state="Karnataka",
            pickup_address_json={
                "line1": "5 Sayyaji Rao Rd",
                "city": "Mysuru",
                "state": "Karnataka",
                "pincode": "570001",
            },
        )

        self.category = Category.objects.create(
            name="Ceramics & Pottery",
            slug="ceramics-pottery",
            commission_rate=Decimal("10.00"),
            is_active=True,
        )

        # Standard product
        self.product_std = Product.objects.create(
            seller=self.seller,
            category=self.category,
            title="Terracotta Chai Kulhad Set",
            slug="terracotta-chai-kulhad-set",
            description="Set of 6 handmade kulhads.",
            base_price=Decimal("1100.00"),
            approval_status=Product.ApprovalStatus.APPROVED,
        )
        self.variant_std = ProductVariant.objects.create(
            product=self.product_std,
            sku="KCS-KULHAD-01",
            label="Set of 6",
            price_override=Decimal("1100.00"),
            is_active=True,
        )
        self.inv_std = Inventory.objects.create(
            variant=self.variant_std,
            quantity_available=5,
            quantity_reserved=0,
        )

        # Personalized / Made-to-Order product
        self.product_custom = Product.objects.create(
            seller=self.seller,
            category=self.category,
            title="Custom Nameplate Ceramic Plaque",
            slug="custom-nameplate-ceramic-plaque",
            description="Hand-painted family nameplate.",
            base_price=Decimal("1500.00"),
            is_customizable=True,
            is_made_to_order=True,
            approval_status=Product.ApprovalStatus.APPROVED,
        )
        self.variant_custom = ProductVariant.objects.create(
            product=self.product_custom,
            sku="KCS-PLAQUE-01",
            label="12x8 inch",
            price_override=Decimal("1500.00"),
            is_active=True,
        )
        self.inv_custom = Inventory.objects.create(
            variant=self.variant_custom,
            quantity_available=3,
            quantity_reserved=0,
        )

        self.address = BuyerAddress.objects.create(
            user=self.buyer,
            label=BuyerAddress.AddressLabel.HOME,
            recipient_name="Ananya Nair",
            phone="9876543210",
            line1="12 MG Road, Ernakulam",
            city="Kochi",
            state="Kerala",
            pincode="682011",
            is_default=True,
        )

    def _create_packed_cod_suborder(self, variant, customization_note=""):
        """Helper: buyer places COD order, seller accepts & marks PACKED."""
        self.client.force_authenticate(user=self.buyer)
        add_res = self.client.post(
            "/api/v1/cart/items/",
            {
                "variant_id": str(variant.id),
                "quantity": 1,
                "customization_note": customization_note,
            },
            format="json",
        )
        self.assertIn(add_res.status_code, (200, 201))

        chk = self.client.post(
            "/api/v1/checkout/",
            {"address_id": str(self.address.id), "payment_method": "COD"},
            format="json",
        )
        self.assertEqual(chk.status_code, 201)
        order_id = chk.data["order"]["id"]
        sub_id = chk.data["order"]["suborders"][0]["id"]

        self.client.force_authenticate(user=self.seller_user)
        r1 = self.client.patch(
            f"/api/v1/seller/suborders/{sub_id}/status/",
            {"status": "ACCEPTED"},
            format="json",
        )
        self.assertEqual(r1.status_code, 200)
        r2 = self.client.patch(
            f"/api/v1/seller/suborders/{sub_id}/status/",
            {"status": "PACKED"},
            format="json",
        )
        self.assertEqual(r2.status_code, 200)
        return order_id, SellerSuborder.objects.get(pk=sub_id)

    def _ship_and_deliver(self, suborder):
        self.client.force_authenticate(user=self.seller_user)
        ship_res = self.client.post(
            f"/api/v1/seller/suborders/{suborder.id}/ship/",
            {
                "courier_name": "Delhivery",
                "tracking_number": "DLV9988776655",
                "tracking_url": "https://www.delhivery.com/track/package/DLV9988776655",
            },
            format="json",
        )
        self.assertEqual(ship_res.status_code, 201)

        del_res = self.client.post(
            f"/api/v1/seller/suborders/{suborder.id}/deliver/",
            {"delivery_notes": "Handed to buyer at front gate."},
            format="json",
        )
        self.assertEqual(del_res.status_code, 200)
        suborder.refresh_from_db()
        return suborder

    def test_courier_dispatch_events_delivery_cod_capture_and_isolation(self):
        """Seller dispatches packed parcel, adds transit event, delivers (capturing COD); other seller blocked."""
        order_id, sub = self._create_packed_cod_suborder(self.variant_std)

        # Other seller cannot dispatch this studio's suborder
        self.client.force_authenticate(user=self.other_seller_user)
        blocked = self.client.post(
            f"/api/v1/seller/suborders/{sub.id}/ship/",
            {"courier_name": "DTDC", "tracking_number": "DTDC0001"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 400)

        # Unsafe tracking URL scheme rejected
        self.client.force_authenticate(user=self.seller_user)
        bad_url = self.client.post(
            f"/api/v1/seller/suborders/{sub.id}/ship/",
            {
                "courier_name": "Blue Dart",
                "tracking_number": "BD12345678",
                "tracking_url": "javascript:alert(1)",
            },
            format="json",
        )
        self.assertEqual(bad_url.status_code, 400)

        # Valid dispatch creates Shipment + DISPATCHED event
        ship_res = self.client.post(
            f"/api/v1/seller/suborders/{sub.id}/ship/",
            {
                "courier_name": "Delhivery",
                "tracking_number": "DLV100200300",
                "tracking_url": "https://www.delhivery.com/track/package/DLV100200300",
                "estimated_delivery_date": (timezone.localdate() + timedelta(days=4)).isoformat(),
            },
            format="json",
        )
        self.assertEqual(ship_res.status_code, 201)
        self.assertEqual(ship_res.data["suborder"]["fulfilment_status"], "SHIPPED")
        self.assertEqual(ship_res.data["suborder"]["shipment"]["courier_name"], "Delhivery")
        self.assertEqual(ShipmentEvent.objects.count(), 1)

        # Add transit event
        ev_res = self.client.post(
            f"/api/v1/seller/suborders/{sub.id}/events/",
            {
                "status": "OUT_FOR_DELIVERY",
                "location": "Ernakulam Hub, Kerala",
                "notes": "Courier agent en route",
            },
            format="json",
        )
        self.assertEqual(ev_res.status_code, 201)
        self.assertEqual(len(ev_res.data["suborder"]["shipment"]["events"]), 2)

        # Mark delivered → stamps delivered_at, syncs parent Order, captures COD payment
        del_res = self.client.post(
            f"/api/v1/seller/suborders/{sub.id}/deliver/",
            {"delivery_notes": "Signed by recipient"},
            format="json",
        )
        self.assertEqual(del_res.status_code, 200)
        self.assertEqual(del_res.data["suborder"]["fulfilment_status"], "DELIVERED")
        self.assertTrue(del_res.data["suborder"]["is_return_eligible"])

        order = Order.objects.get(pk=order_id)
        self.assertEqual(order.overall_status, Order.OverallStatus.DELIVERED)
        self.assertEqual(order.payment_status, Order.PaymentStatus.PAID)
        cod_pay = Payment.objects.get(order=order, provider=Payment.Provider.COD)
        self.assertEqual(cod_pay.status, Payment.Status.CAPTURED)

    @patch("apps.shipping.services.upload_image_to_cloudinary")
    def test_7_day_return_window_and_optional_cloudinary_proof(self, mock_cloud):
        """Buyer submits return within 7 days with Cloudinary proof; duplicate & expired returns blocked."""
        mock_cloud.return_value = {
            "image_url": "https://res.cloudinary.com/demo/image/upload/v1/craftify/returns/proof1.jpg",
            "cloudinary_public_id": "craftify/returns/proof1",
        }
        _, sub = self._create_packed_cod_suborder(self.variant_std)
        sub = self._ship_and_deliver(sub)
        item = sub.items.first()

        # Submit return on day 1 with optional photo proof
        self.client.force_authenticate(user=self.buyer)
        fake_img = SimpleUploadedFile("crack.jpg", b"fake-jpeg-bytes", content_type="image/jpeg")
        res = self.client.post(
            "/api/v1/buyer/returns/",
            {
                "order_item_id": str(item.id),
                "reason": "DAMAGED",
                "description": "Two terracotta kulhads arrived cracked inside the box.",
                "quantity": 1,
                "evidence_images": [fake_img],
            },
            format="multipart",
        )
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.data["return_request"]["status"], "REQUESTED")
        self.assertEqual(len(res.data["return_request"]["evidence_urls"]), 1)
        self.assertEqual(Decimal(res.data["return_request"]["refund_amount"]), Decimal("1100.00"))

        # Duplicate active return for same item rejected
        dup = self.client.post(
            "/api/v1/buyer/returns/",
            {
                "order_item_id": str(item.id),
                "reason": "DAMAGED",
                "description": "Duplicate submission attempt.",
            },
            format="json",
        )
        self.assertEqual(dup.status_code, 400)

        # Test expired 8-day window on a fresh delivered suborder
        _, sub2 = self._create_packed_cod_suborder(self.variant_std)
        sub2 = self._ship_and_deliver(sub2)
        sub2.delivered_at = timezone.now() - timedelta(days=8)
        sub2.save(update_fields=["delivered_at"])
        item2 = sub2.items.first()

        self.client.force_authenticate(user=self.buyer)
        expired_res = self.client.post(
            "/api/v1/buyer/returns/",
            {
                "order_item_id": str(item2.id),
                "reason": "NOT_AS_DESCRIBED",
                "description": "Trying to return after 8 days of delivery.",
            },
            format="json",
        )
        self.assertEqual(expired_res.status_code, 400)

    def test_personalized_made_to_order_craft_blocks_non_defect_return_reasons(self):
        """Personalized / made-to-order items reject SIZE_OR_FIT but accept DAMAGED/WRONG_ITEM."""
        _, sub = self._create_packed_cod_suborder(
            self.variant_custom, customization_note="Engrave: The Nair Residence"
        )
        sub = self._ship_and_deliver(sub)
        item = sub.items.first()

        self.client.force_authenticate(user=self.buyer)
        # Non-defect reason blocked
        bad_reason = self.client.post(
            "/api/v1/buyer/returns/",
            {
                "order_item_id": str(item.id),
                "reason": "SIZE_OR_FIT",
                "description": "Changed my mind about the wall size.",
            },
            format="json",
        )
        self.assertEqual(bad_reason.status_code, 400)
        self.assertIn("reason", bad_reason.data)

        # Damaged reason accepted
        ok_reason = self.client.post(
            "/api/v1/buyer/returns/",
            {
                "order_item_id": str(item.id),
                "reason": "DAMAGED",
                "description": "Corner of ceramic nameplate chipped during courier transit.",
            },
            format="json",
        )
        self.assertEqual(ok_reason.status_code, 201)

    def test_seller_direct_return_approval_completion_restock_and_isolation(self):
        """Seller directly approves -> picks up -> completes return with inventory restock; other seller blocked."""
        _, sub = self._create_packed_cod_suborder(self.variant_std)
        sub = self._ship_and_deliver(sub)
        item = sub.items.first()
        self.inv_std.refresh_from_db()
        self.assertEqual(self.inv_std.quantity_available, 4)

        self.client.force_authenticate(user=self.buyer)
        ret_res = self.client.post(
            "/api/v1/buyer/returns/",
            {
                "order_item_id": str(item.id),
                "reason": "NOT_AS_DESCRIBED",
                "description": "Glaze shade looks noticeably lighter than studio photos.",
            },
            format="json",
        )
        self.assertEqual(ret_res.status_code, 201)
        ret_id = ret_res.data["return_request"]["id"]

        # Other seller cannot resolve this return
        self.client.force_authenticate(user=self.other_seller_user)
        blocked = self.client.patch(
            f"/api/v1/seller/returns/{ret_id}/resolve/",
            {"status": "APPROVED"},
            format="json",
        )
        self.assertEqual(blocked.status_code, 400)

        # Owning seller sees pending return and approves -> picked up -> completed with restock
        self.client.force_authenticate(user=self.seller_user)
        list_res = self.client.get("/api/v1/seller/returns/")
        self.assertEqual(list_res.status_code, 200)
        self.assertEqual(list_res.data["pending_count"], 1)

        r_approve = self.client.patch(
            f"/api/v1/seller/returns/{ret_id}/resolve/",
            {"status": "APPROVED", "seller_response_note": "Reverse pickup scheduled via Delhivery."},
            format="json",
        )
        self.assertEqual(r_approve.status_code, 200)
        self.assertEqual(r_approve.data["return_request"]["status"], "APPROVED")

        r_pickup = self.client.patch(
            f"/api/v1/seller/returns/{ret_id}/resolve/",
            {"status": "PICKED_UP"},
            format="json",
        )
        self.assertEqual(r_pickup.status_code, 200)

        r_complete = self.client.patch(
            f"/api/v1/seller/returns/{ret_id}/resolve/",
            {
                "status": "COMPLETED",
                "seller_response_note": "Received intact at Kochi studio.",
                "restock_inventory": True,
            },
            format="json",
        )
        self.assertEqual(r_complete.status_code, 200)
        self.assertTrue(r_complete.data["return_request"]["restocked"])

        # Inventory restored back to 5 and suborder transitioned to RETURNED
        self.inv_std.refresh_from_db()
        self.assertEqual(self.inv_std.quantity_available, 5)
        self.assertTrue(
            InventoryTransaction.objects.filter(
                inventory=self.inv_std,
                change_type=InventoryTransaction.ChangeType.RETURN,
            ).exists()
        )
        sub.refresh_from_db()
        self.assertEqual(sub.fulfilment_status, SellerSuborder.FulfilmentStatus.RETURNED)

    def test_seller_return_rejection_requires_note_and_admin_can_audit(self):
        """Rejecting a return requires an explanation note; Admin can view all returns read-only."""
        _, sub = self._create_packed_cod_suborder(self.variant_std)
        sub = self._ship_and_deliver(sub)
        item = sub.items.first()

        self.client.force_authenticate(user=self.buyer)
        ret_res = self.client.post(
            "/api/v1/buyer/returns/",
            {
                "order_item_id": str(item.id),
                "reason": "DEFECTIVE",
                "description": "Handle appears slightly uneven on one cup.",
            },
            format="json",
        )
        ret_id = ret_res.data["return_request"]["id"]

        # Reject without note fails
        self.client.force_authenticate(user=self.seller_user)
        bad_rej = self.client.patch(
            f"/api/v1/seller/returns/{ret_id}/resolve/",
            {"status": "REJECTED", "seller_response_note": ""},
            format="json",
        )
        self.assertEqual(bad_rej.status_code, 400)

        # Reject with note succeeds
        ok_rej = self.client.patch(
            f"/api/v1/seller/returns/{ret_id}/resolve/",
            {
                "status": "REJECTED",
                "seller_response_note": "Natural wheel-thrown variation noted on listing; no structural crack.",
            },
            format="json",
        )
        self.assertEqual(ok_rej.status_code, 200)
        self.assertEqual(ok_rej.data["return_request"]["status"], "REJECTED")

        # Admin read-only returns audit view
        self.client.force_authenticate(user=self.admin)
        admin_res = self.client.get("/api/v1/admin/returns/")
        self.assertEqual(admin_res.status_code, 200)
        self.assertEqual(admin_res.data["count"], 1)
