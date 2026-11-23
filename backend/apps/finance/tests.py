"""Week 10 Automated Tests: Financial Ledger, 7-Day Settlement Holds, Refunds & Seller Payouts."""
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.audit.models import AuditLog
from apps.catalog.models import Category, Inventory, Product, ProductVariant
from apps.commerce.models import BuyerAddress
from apps.finance.models import LedgerEntry, RefundRecord, SellerPayout
from apps.orders.models import Order, Payment
from apps.sellers.models import SellerProfile

User = get_user_model()


class FinanceLedgerRefundPayoutTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.admin = User.objects.create_user(
            username="fin_admin",
            email="fin_admin@craftify.in",
            password="StrongPassword!123",
            role=User.Role.ADMIN,
            is_email_verified=True,
            is_staff=True,
        )
        self.buyer = User.objects.create_user(
            username="fin_buyer",
            email="fin_buyer@craftify.in",
            password="StrongPassword!123",
            role=User.Role.BUYER,
            is_email_verified=True,
        )
        self.seller_user = User.objects.create_user(
            username="fin_seller",
            email="fin_seller@craftify.in",
            password="StrongPassword!123",
            role=User.Role.SELLER,
            is_email_verified=True,
        )
        self.other_seller_user = User.objects.create_user(
            username="fin_seller_two",
            email="fin_seller2@craftify.in",
            password="StrongPassword!123",
            role=User.Role.SELLER,
            is_email_verified=True,
        )

        self.seller_profile = SellerProfile.objects.create(
            user=self.seller_user,
            shop_name="Kutch Weaves Studio",
            slug="kutch-weaves-studio",
            city="Bhuj",
            state="Gujarat",
            pickup_address_json={
                "line1": "12 Artisan Lane",
                "city": "Bhuj",
                "state": "Gujarat",
                "pincode": "370001",
            },
            bank_account_masked="XXXX-XXXX-4821",
            ifsc_code="SBIN0001234",
        )
        self.other_seller_profile = SellerProfile.objects.create(
            user=self.other_seller_user,
            shop_name="Jaipur Clay Works",
            slug="jaipur-clay-works",
            city="Jaipur",
            state="Rajasthan",
            pickup_address_json={"line1": "8 Potter St", "city": "Jaipur", "pincode": "302001"},
            bank_account_masked="XXXX-XXXX-9910",
            ifsc_code="HDFC0004321",
        )

        self.category = Category.objects.create(
            name="Handloom Textiles",
            slug="handloom-textiles",
            commission_rate=Decimal("10.00"),
        )
        self.product = Product.objects.create(
            seller=self.seller_profile,
            category=self.category,
            title="Handwoven Ajrakh Cotton Stole",
            slug="handwoven-ajrakh-cotton-stole",
            description="Natural indigo block-printed handloom cotton stole from Kutch.",
            base_price=Decimal("1200.00"),
            approval_status=Product.ApprovalStatus.APPROVED,
        )
        self.variant = ProductVariant.objects.create(
            product=self.product,
            label="Indigo Standard",
            sku="AJR-IND-001",
            price_override=Decimal("1200.00"),
        )
        Inventory.objects.create(
            variant=self.variant,
            quantity_available=10,
            quantity_reserved=0,
        )

        self.address = BuyerAddress.objects.create(
            user=self.buyer,
            label=BuyerAddress.AddressLabel.HOME,
            recipient_name="Ananya Sharma",
            phone="9876543210",
            line1="44 Park Street",
            city="Kolkata",
            state="West Bengal",
            pincode="700016",
        )

    def _place_and_deliver_cod_suborder(self):
        """Helper: Buyer places ₹1200 COD order, Seller accepts -> packs -> dispatches -> delivers."""
        self.client.force_authenticate(user=self.buyer)
        add_res = self.client.post(
            "/api/v1/cart/items/",
            {"variant_id": str(self.variant.id), "quantity": 1},
            format="json",
        )
        self.assertIn(add_res.status_code, (200, 201))

        checkout_res = self.client.post(
            "/api/v1/checkout/",
            {"address_id": str(self.address.id), "payment_method": "COD"},
            format="json",
        )
        self.assertEqual(checkout_res.status_code, 201)
        order_data = checkout_res.data["order"]
        suborder_id = order_data["suborders"][0]["id"]
        order_item_id = order_data["suborders"][0]["items"][0]["id"]

        self.client.force_authenticate(user=self.seller_user)
        for next_status in ("ACCEPTED", "PACKED"):
            res = self.client.patch(
                f"/api/v1/seller/suborders/{suborder_id}/status/",
                {"status": next_status},
                format="json",
            )
            self.assertEqual(res.status_code, 200)

        disp_res = self.client.post(
            f"/api/v1/seller/suborders/{suborder_id}/ship/",
            {
                "courier_name": "Delhivery",
                "tracking_number": "DLV987654321",
            },
            format="json",
        )
        self.assertEqual(disp_res.status_code, 201)

        deliv_res = self.client.post(
            f"/api/v1/seller/suborders/{suborder_id}/deliver/",
            {"delivery_notes": "Handed to recipient"},
            format="json",
        )
        self.assertEqual(deliv_res.status_code, 200)
        return order_data["id"], suborder_id, order_item_id

    def test_delivery_creates_7_day_hold_ledger_and_admin_release(self):
        _, suborder_id, _ = self._place_and_deliver_cod_suborder()

        # ₹1200 sale at 10% commission -> ₹120 commission, ₹1080 net seller credit in 7-day hold
        self.client.force_authenticate(user=self.seller_user)
        fin_res = self.client.get("/api/v1/seller/finance/")
        self.assertEqual(fin_res.status_code, 200)
        summary = fin_res.data["summary"]
        self.assertEqual(summary["total_net_earned"], "1080.00")
        self.assertEqual(summary["total_commission_paid"], "120.00")
        self.assertEqual(summary["pending_settlement"], "1080.00")
        self.assertEqual(summary["available_balance"], "0.00")

        # Seller cannot withdraw while funds are locked in the 7-day settlement hold
        blocked_res = self.client.post(
            "/api/v1/seller/finance/payouts/",
            {"amount": "500.00"},
            format="json",
        )
        self.assertEqual(blocked_res.status_code, 400)

        # Admin releases hold early
        sale_entry = LedgerEntry.objects.get(
            suborder_id=suborder_id,
            entry_type=LedgerEntry.EntryType.SALE_CREDIT,
        )
        self.client.force_authenticate(user=self.admin)
        release_res = self.client.post(
            f"/api/v1/admin/finance/ledger/{sale_entry.id}/release-hold/",
            {"reason": "Verified delivery confirmation"},
            format="json",
        )
        self.assertEqual(release_res.status_code, 200)
        self.assertTrue(release_res.data["entry"]["hold_released_early"])
        self.assertEqual(release_res.data["entry"]["settlement_state"], "AVAILABLE")

        # Now Seller sees ₹1080.00 available and ₹0.00 pending settlement
        self.client.force_authenticate(user=self.seller_user)
        fin_after = self.client.get("/api/v1/seller/finance/")
        self.assertEqual(fin_after.data["summary"]["pending_settlement"], "0.00")
        self.assertEqual(fin_after.data["summary"]["available_balance"], "1080.00")
        self.assertTrue(
            AuditLog.objects.filter(action="SETTLEMENT_HOLD_RELEASED").exists()
        )

    def test_completed_return_creates_refund_and_offsets_held_settlement(self):
        _, _, order_item_id = self._place_and_deliver_cod_suborder()

        # Buyer requests a 7-day return
        self.client.force_authenticate(user=self.buyer)
        ret_res = self.client.post(
            "/api/v1/buyer/returns/",
            {
                "order_item_id": order_item_id,
                "reason": "DAMAGED",
                "description": "Edge weave arrived torn during transit.",
                "quantity": 1,
            },
            format="json",
        )
        self.assertEqual(ret_res.status_code, 201)
        return_id = ret_res.data["return_request"]["id"]

        # Seller approves then completes return
        self.client.force_authenticate(user=self.seller_user)
        self.assertEqual(
            self.client.post(
                f"/api/v1/seller/returns/{return_id}/resolve/",
                {"status": "APPROVED", "seller_response_note": "Approved for pickup"},
                format="json",
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.post(
                f"/api/v1/seller/returns/{return_id}/resolve/",
                {
                    "status": "COMPLETED",
                    "seller_response_note": "Received parcel back",
                    "restock_inventory": False,
                },
                format="json",
            ).status_code,
            200,
        )

        # RefundRecord created with proportional commission reversal (₹120) & seller debit (₹1080)
        refund = RefundRecord.objects.get(return_request_id=return_id)
        self.assertEqual(refund.amount, Decimal("1200.00"))
        self.assertEqual(refund.commission_reversed, Decimal("120.00"))
        self.assertEqual(refund.net_seller_deduction, Decimal("1080.00"))
        self.assertEqual(refund.status, RefundRecord.Status.PENDING)

        # Seller pending_settlement is cleanly netted to ₹0.00 (no phantom held balance!)
        fin_res = self.client.get("/api/v1/seller/finance/")
        self.assertEqual(fin_res.data["summary"]["pending_settlement"], "0.00")
        self.assertEqual(fin_res.data["summary"]["available_balance"], "0.00")
        self.assertEqual(fin_res.data["summary"]["total_refund_debits"], "1080.00")
        self.assertEqual(fin_res.data["summary"]["total_commission_paid"], "0.00")

        # Admin processes refund with reference ID
        self.client.force_authenticate(user=self.admin)
        proc_res = self.client.post(
            f"/api/v1/admin/finance/refunds/{refund.id}/action/",
            {
                "status": "PROCESSED",
                "gateway_refund_id": "rfnd_craftify_001",
                "admin_notes": "Refund transferred via UPI",
            },
            format="json",
        )
        self.assertEqual(proc_res.status_code, 200)
        self.assertEqual(proc_res.data["refund"]["status"], "PROCESSED")

        # Buyer can see their processed refund
        self.client.force_authenticate(user=self.buyer)
        buyer_refunds = self.client.get("/api/v1/buyer/refunds/")
        self.assertEqual(buyer_refunds.status_code, 200)
        self.assertEqual(buyer_refunds.data["count"], 1)
        self.assertEqual(buyer_refunds.data["results"][0]["status"], "PROCESSED")

    def test_seller_payout_lifecycle_paid_rejected_and_overspend_blocked(self):
        _, suborder_id, _ = self._place_and_deliver_cod_suborder()

        # Release hold so ₹1080.00 is available
        sale_entry = LedgerEntry.objects.get(
            suborder_id=suborder_id,
            entry_type=LedgerEntry.EntryType.SALE_CREDIT,
        )
        self.client.force_authenticate(user=self.admin)
        self.client.post(
            f"/api/v1/admin/finance/ledger/{sale_entry.id}/release-hold/",
            {"reason": "Ready for payout"},
            format="json",
        )

        # Seller requests ₹600.00 payout
        self.client.force_authenticate(user=self.seller_user)
        p1_res = self.client.post(
            "/api/v1/seller/finance/payouts/",
            {"amount": "600.00", "seller_notes": "Monthly artisan studio transfer"},
            format="json",
        )
        self.assertEqual(p1_res.status_code, 201)
        payout1_id = p1_res.data["payout"]["id"]
        self.assertEqual(p1_res.data["summary"]["available_balance"], "480.00")
        self.assertEqual(p1_res.data["summary"]["in_flight_payouts"], "600.00")

        # Overspend / double-withdrawal attempt of ₹500.00 (> ₹480.00) must fail
        over_res = self.client.post(
            "/api/v1/seller/finance/payouts/",
            {"amount": "500.00"},
            format="json",
        )
        self.assertEqual(over_res.status_code, 400)

        # Admin marks payout #1 PAID with UTR reference
        self.client.force_authenticate(user=self.admin)
        paid_res = self.client.post(
            f"/api/v1/admin/finance/payouts/{payout1_id}/action/",
            {
                "status": "PAID",
                "utr_reference": "UTR261123NEFT9981",
                "admin_notes": "Disbursed via NEFT",
            },
            format="json",
        )
        self.assertEqual(paid_res.status_code, 200)
        self.assertEqual(paid_res.data["payout"]["status"], "PAID")

        # Seller requests ₹400.00 payout #2 -> Admin REJECTS it -> ₹400 restored to available
        self.client.force_authenticate(user=self.seller_user)
        p2_res = self.client.post(
            "/api/v1/seller/finance/payouts/",
            {"amount": "400.00"},
            format="json",
        )
        self.assertEqual(p2_res.status_code, 201)
        payout2_id = p2_res.data["payout"]["id"]
        self.assertEqual(p2_res.data["summary"]["available_balance"], "80.00")

        self.client.force_authenticate(user=self.admin)
        rej_res = self.client.post(
            f"/api/v1/admin/finance/payouts/{payout2_id}/action/",
            {
                "status": "REJECTED",
                "admin_notes": "IFSC bank branch verification pending",
            },
            format="json",
        )
        self.assertEqual(rej_res.status_code, 200)

        self.client.force_authenticate(user=self.seller_user)
        final_fin = self.client.get("/api/v1/seller/finance/")
        self.assertEqual(final_fin.data["summary"]["total_paid_out"], "600.00")
        self.assertEqual(final_fin.data["summary"]["in_flight_payouts"], "0.00")
        self.assertEqual(final_fin.data["summary"]["available_balance"], "480.00")

    def test_paid_razorpay_cancellation_queues_refund_and_marks_order_refunded(self):
        # Create a confirmed PAID Razorpay order directly and cancel via buyer API
        self.client.force_authenticate(user=self.buyer)
        self.client.post(
            "/api/v1/cart/items/",
            {"variant_id": str(self.variant.id), "quantity": 1},
            format="json",
        )
        res = self.client.post(
            "/api/v1/checkout/",
            {"address_id": str(self.address.id), "payment_method": "COD"},
            format="json",
        )
        order = Order.objects.get(pk=res.data["order"]["id"])
        # Simulate that this order was a PAID Razorpay prepaid order
        order.payment_method = Order.PaymentMethod.RAZORPAY
        order.payment_status = Order.PaymentStatus.PAID
        order.save(update_fields=["payment_method", "payment_status"])
        Payment.objects.filter(order=order).update(
            provider=Payment.Provider.RAZORPAY,
            status=Payment.Status.CAPTURED,
        )

        cancel_res = self.client.post(f"/api/v1/buyer/orders/{order.id}/cancel/")
        self.assertEqual(cancel_res.status_code, 200)

        refund = RefundRecord.objects.get(order=order)
        self.assertEqual(refund.trigger_source, RefundRecord.TriggerSource.BUYER_CANCELLATION)
        self.assertEqual(refund.amount, order.total_amount)
        # No seller ledger debit because order was cancelled before delivery
        self.assertFalse(
            LedgerEntry.objects.filter(entry_type=LedgerEntry.EntryType.REFUND_DEBIT).exists()
        )

        # Admin processes refund -> parent order payment_status becomes REFUNDED
        self.client.force_authenticate(user=self.admin)
        proc = self.client.post(
            f"/api/v1/admin/finance/refunds/{refund.id}/action/",
            {"status": "PROCESSED", "gateway_refund_id": "rfnd_rzp_cancel_01"},
            format="json",
        )
        self.assertEqual(proc.status_code, 200)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, Order.PaymentStatus.REFUNDED)

    def test_finance_rbac_and_cross_seller_isolation(self):
        self._place_and_deliver_cod_suborder()

        # Buyer blocked from seller & admin finance endpoints
        self.client.force_authenticate(user=self.buyer)
        self.assertEqual(self.client.get("/api/v1/seller/finance/").status_code, 403)
        self.assertEqual(self.client.get("/api/v1/admin/finance/").status_code, 403)

        # Seller blocked from admin finance endpoints
        self.client.force_authenticate(user=self.seller_user)
        self.assertEqual(self.client.get("/api/v1/admin/finance/").status_code, 403)

        # Other seller sees strictly ₹0.00 and zero ledger entries from seller 1
        self.client.force_authenticate(user=self.other_seller_user)
        other_res = self.client.get("/api/v1/seller/finance/")
        self.assertEqual(other_res.status_code, 200)
        self.assertEqual(other_res.data["summary"]["total_net_earned"], "0.00")
        self.assertEqual(len(other_res.data["ledger"]), 0)
        self.assertEqual(len(other_res.data["payouts"]), 0)
