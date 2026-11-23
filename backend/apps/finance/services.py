"""Authoritative transactional services for Craftify Ledger, 7-Day Settlement, Refunds & Payouts."""
import secrets
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import record_audit_log
from apps.commerce.services import quantize_inr
from apps.finance.models import LedgerEntry, RefundRecord, SellerPayout
from apps.orders.models import Order, Payment, SellerSuborder
from apps.sellers.models import SellerProfile


def get_settlement_hold_days() -> int:
    return int(getattr(settings, "CRAFTIFY_SETTLEMENT_HOLD_DAYS", 7))


def _generate_unique_refund_number() -> str:
    date_part = timezone.localdate().strftime("%y%m%d")
    for _ in range(12):
        suffix = secrets.randbelow(9000) + 1000
        candidate = f"RFD{date_part}-{suffix}"
        if not RefundRecord.objects.filter(refund_number=candidate).exists():
            return candidate
    return f"RFD{date_part}-{secrets.token_hex(3).upper()}"


def _generate_unique_payout_number() -> str:
    date_part = timezone.localdate().strftime("%y%m%d")
    for _ in range(12):
        suffix = secrets.randbelow(9000) + 1000
        candidate = f"PAY{date_part}-{suffix}"
        if not SellerPayout.objects.filter(payout_number=candidate).exists():
            return candidate
    return f"PAY{date_part}-{secrets.token_hex(3).upper()}"


# ---------------------------------------------------------------------------
# 1. Automated Settlement & Refund Hooks (called by shipping & orders services)
# ---------------------------------------------------------------------------


@transaction.atomic
def record_delivery_settlement_entries(
    *,
    suborder: SellerSuborder,
    actor=None,
    request=None,
) -> tuple[LedgerEntry | None, LedgerEntry | None]:
    """
    Idempotently append SALE_CREDIT (with 7-day settlement hold) and PLATFORM_COMMISSION
    entries to the immutable LedgerEntry table when a SellerSuborder is marked DELIVERED.
    """
    delivered_at = suborder.delivered_at or timezone.now()
    hold_days = get_settlement_hold_days()
    available_at = delivered_at + timedelta(days=hold_days)

    sale_entry = None
    commission_entry = None

    net_amount = quantize_inr(suborder.net_seller_amount)
    if net_amount > Decimal("0.00"):
        sale_entry, created = LedgerEntry.objects.get_or_create(
            idempotency_key=f"sale-credit-{suborder.id}",
            defaults={
                "seller": suborder.seller,
                "suborder": suborder,
                "entry_type": LedgerEntry.EntryType.SALE_CREDIT,
                "direction": LedgerEntry.Direction.CREDIT,
                "amount": net_amount,
                "available_at": available_at,
                "description": (
                    f"Delivered earnings for {suborder.suborder_number} "
                    f"({hold_days}-day settlement hold)"
                ),
                "metadata": {
                    "suborder_number": suborder.suborder_number,
                    "subtotal_amount": str(suborder.subtotal_amount),
                    "discount_share": str(suborder.discount_share),
                    "commission_amount": str(suborder.commission_amount),
                    "hold_days": hold_days,
                },
            },
        )
        if created:
            record_audit_log(
                actor=actor or suborder.seller.user,
                action="LEDGER_SALE_CREDITED",
                target_model="LedgerEntry",
                target_id=sale_entry.id,
                summary=(
                    f"Credited ₹{net_amount} to {suborder.seller.shop_name} for "
                    f"{suborder.suborder_number} (releases {available_at.date().isoformat()})"
                ),
                metadata={
                    "suborder_number": suborder.suborder_number,
                    "net_seller_amount": str(net_amount),
                    "commission_amount": str(suborder.commission_amount),
                    "available_at": available_at.isoformat(),
                },
                request=request,
            )

    commission_amount = quantize_inr(suborder.commission_amount)
    if commission_amount > Decimal("0.00"):
        commission_entry, _ = LedgerEntry.objects.get_or_create(
            idempotency_key=f"platform-comm-{suborder.id}",
            defaults={
                "seller": suborder.seller,
                "suborder": suborder,
                "entry_type": LedgerEntry.EntryType.PLATFORM_COMMISSION,
                "direction": LedgerEntry.Direction.DEBIT,
                "amount": commission_amount,
                "available_at": delivered_at,
                "description": f"Craftify category commission on {suborder.suborder_number}",
                "metadata": {
                    "suborder_number": suborder.suborder_number,
                    "subtotal_amount": str(suborder.subtotal_amount),
                },
            },
        )

    return sale_entry, commission_entry


@transaction.atomic
def record_return_refund(
    *,
    return_request,
    actor=None,
    request=None,
) -> RefundRecord:
    """
    Idempotently create a RefundRecord and append REFUND_DEBIT + COMMISSION_REVERSAL
    ledger entries when a 7-day buyer ReturnRequest transitions to COMPLETED.
    """
    suborder = return_request.suborder
    parent_order = suborder.parent_order
    refund_amount = quantize_inr(return_request.refund_amount)

    commission_rate = return_request.order_item.commission_rate_snapshot
    raw_comm_rev = quantize_inr(
        (refund_amount * commission_rate) / Decimal("100.00")
    )
    commission_reversed = min(raw_comm_rev, quantize_inr(suborder.commission_amount))
    net_seller_deduction = quantize_inr(
        max(Decimal("0.00"), refund_amount - commission_reversed)
    )

    refund, created = RefundRecord.objects.get_or_create(
        idempotency_key=f"ret-refund-{return_request.id}",
        defaults={
            "refund_number": _generate_unique_refund_number(),
            "order": parent_order,
            "suborder": suborder,
            "return_request": return_request,
            "buyer": return_request.buyer,
            "payment_method": parent_order.payment_method,
            "trigger_source": RefundRecord.TriggerSource.RETURN_COMPLETED,
            "amount": refund_amount,
            "commission_reversed": commission_reversed,
            "net_seller_deduction": net_seller_deduction,
            "status": RefundRecord.Status.PENDING,
        },
    )

    now = timezone.now()
    if net_seller_deduction > Decimal("0.00"):
        LedgerEntry.objects.get_or_create(
            idempotency_key=f"ret-debit-{return_request.id}",
            defaults={
                "seller": suborder.seller,
                "suborder": suborder,
                "return_request": return_request,
                "refund": refund,
                "entry_type": LedgerEntry.EntryType.REFUND_DEBIT,
                "direction": LedgerEntry.Direction.DEBIT,
                "amount": net_seller_deduction,
                "available_at": now,
                "description": (
                    f"Return refund debit for {return_request.return_number} "
                    f"({suborder.suborder_number})"
                ),
                "metadata": {
                    "return_number": return_request.return_number,
                    "refund_number": refund.refund_number,
                    "gross_refund": str(refund_amount),
                    "commission_reversed": str(commission_reversed),
                },
            },
        )

    if commission_reversed > Decimal("0.00"):
        LedgerEntry.objects.get_or_create(
            idempotency_key=f"ret-comm-rev-{return_request.id}",
            defaults={
                "seller": suborder.seller,
                "suborder": suborder,
                "return_request": return_request,
                "refund": refund,
                "entry_type": LedgerEntry.EntryType.COMMISSION_REVERSAL,
                "direction": LedgerEntry.Direction.CREDIT,
                "amount": commission_reversed,
                "available_at": now,
                "description": (
                    f"Platform commission reversed for {return_request.return_number}"
                ),
                "metadata": {
                    "return_number": return_request.return_number,
                    "refund_number": refund.refund_number,
                },
            },
        )

    if created:
        record_audit_log(
            actor=actor or suborder.seller.user,
            action="REFUND_RECORD_CREATED",
            target_model="RefundRecord",
            target_id=refund.id,
            summary=(
                f"Created refund {refund.refund_number} (₹{refund_amount}) for "
                f"completed return {return_request.return_number}"
            ),
            metadata={
                "refund_number": refund.refund_number,
                "return_number": return_request.return_number,
                "amount": str(refund_amount),
                "net_seller_deduction": str(net_seller_deduction),
                "commission_reversed": str(commission_reversed),
            },
            request=request,
        )

    return refund


@transaction.atomic
def record_order_cancellation_refund(
    *,
    order: Order,
    suborder: SellerSuborder | None = None,
    trigger_source: str = RefundRecord.TriggerSource.BUYER_CANCELLATION,
    actor=None,
    request=None,
) -> RefundRecord | None:
    """
    Create a RefundRecord when a PAID Razorpay order (or prepaid suborder) is cancelled
    before dispatch. Does not debit the seller ledger because SALE_CREDIT is only booked
    on delivery.
    """
    if (
        order.payment_method != Order.PaymentMethod.RAZORPAY
        or order.payment_status != Order.PaymentStatus.PAID
    ):
        return None

    if suborder is not None:
        refund_amount = quantize_inr(
            max(
                Decimal("0.00"),
                suborder.subtotal_amount - suborder.discount_share + suborder.shipping_share,
            )
        )
        idem_key = f"suborder-cancel-refund-{suborder.id}"
    else:
        refund_amount = quantize_inr(order.total_amount)
        idem_key = f"order-cancel-refund-{order.id}"

    if refund_amount <= Decimal("0.00"):
        return None

    refund, created = RefundRecord.objects.get_or_create(
        idempotency_key=idem_key,
        defaults={
            "refund_number": _generate_unique_refund_number(),
            "order": order,
            "suborder": suborder,
            "buyer": order.buyer,
            "payment_method": order.payment_method,
            "trigger_source": trigger_source,
            "amount": refund_amount,
            "commission_reversed": Decimal("0.00"),
            "net_seller_deduction": Decimal("0.00"),
            "status": RefundRecord.Status.PENDING,
        },
    )

    if created:
        record_audit_log(
            actor=actor or order.buyer,
            action="CANCELLATION_REFUND_CREATED",
            target_model="RefundRecord",
            target_id=refund.id,
            summary=(
                f"Queued prepaid refund {refund.refund_number} (₹{refund_amount}) "
                f"for cancelled {suborder.suborder_number if suborder else order.order_number}"
            ),
            metadata={
                "refund_number": refund.refund_number,
                "order_number": order.order_number,
                "suborder_number": suborder.suborder_number if suborder else "",
                "amount": str(refund_amount),
                "trigger_source": trigger_source,
            },
            request=request,
        )

    return refund


# ---------------------------------------------------------------------------
# 2. Authoritative Balance Computation (Seller & Platform)
# ---------------------------------------------------------------------------


def compute_seller_balance(seller_profile: SellerProfile) -> dict:
    """
    Compute exact INR balances for a SellerProfile directly from immutable LedgerEntry
    and SellerPayout rows, dynamically evaluating the 7-day settlement hold window.
    """
    now = timezone.now()
    entries = list(
        LedgerEntry.objects.filter(seller=seller_profile).values(
            "entry_type", "amount", "available_at", "suborder_id"
        )
    )

    total_net_earned = Decimal("0.00")
    total_commission_gross = Decimal("0.00")
    total_commission_reversed = Decimal("0.00")
    total_refund_debits = Decimal("0.00")
    total_payout_debits = Decimal("0.00")
    total_payout_reversals = Decimal("0.00")

    held_by_suborder: dict = {}
    refunds_by_suborder: dict = {}

    for row in entries:
        amt = row["amount"]
        etype = row["entry_type"]
        sub_id = row["suborder_id"]

        if etype == LedgerEntry.EntryType.SALE_CREDIT:
            total_net_earned += amt
            if row["available_at"] and row["available_at"] > now:
                held_by_suborder[sub_id] = held_by_suborder.get(sub_id, Decimal("0.00")) + amt
        elif etype == LedgerEntry.EntryType.PLATFORM_COMMISSION:
            total_commission_gross += amt
        elif etype == LedgerEntry.EntryType.COMMISSION_REVERSAL:
            total_commission_reversed += amt
        elif etype == LedgerEntry.EntryType.REFUND_DEBIT:
            total_refund_debits += amt
            if sub_id is not None:
                refunds_by_suborder[sub_id] = (
                    refunds_by_suborder.get(sub_id, Decimal("0.00")) + amt
                )
        elif etype == LedgerEntry.EntryType.PAYOUT_DEBIT:
            total_payout_debits += amt
        elif etype == LedgerEntry.EntryType.PAYOUT_REVERSAL:
            total_payout_reversals += amt

    # Offset held credits by any return refund debit on the exact same suborder
    pending_settlement = Decimal("0.00")
    for sub_id, held_amt in held_by_suborder.items():
        sub_refund = refunds_by_suborder.get(sub_id, Decimal("0.00"))
        net_held = max(Decimal("0.00"), held_amt - sub_refund)
        pending_settlement += net_held

    available_balance = max(
        Decimal("0.00"),
        total_net_earned
        - pending_settlement
        - total_refund_debits
        - total_payout_debits
        + total_payout_reversals,
    )

    total_commission_paid = max(
        Decimal("0.00"),
        total_commission_gross - total_commission_reversed,
    )

    payout_aggs = SellerPayout.objects.filter(seller=seller_profile)
    total_paid_out = (
        payout_aggs.filter(status=SellerPayout.Status.PAID).aggregate(
            total=Sum("amount")
        )["total"]
        or Decimal("0.00")
    )
    in_flight_payouts = (
        payout_aggs.filter(
            status__in=[SellerPayout.Status.REQUESTED, SellerPayout.Status.PROCESSING]
        ).aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )

    return {
        "currency": "INR",
        "settlement_hold_days": get_settlement_hold_days(),
        "total_net_earned": quantize_inr(total_net_earned),
        "total_commission_paid": quantize_inr(total_commission_paid),
        "total_refund_debits": quantize_inr(total_refund_debits),
        "pending_settlement": quantize_inr(pending_settlement),
        "available_balance": quantize_inr(available_balance),
        "in_flight_payouts": quantize_inr(in_flight_payouts),
        "total_paid_out": quantize_inr(total_paid_out),
        "bank_account_masked": seller_profile.bank_account_masked,
        "ifsc_code": seller_profile.ifsc_code,
        "has_payout_bank_details": bool(
            (seller_profile.bank_account_masked or "").strip()
            and (seller_profile.ifsc_code or "").strip()
        ),
    }


def compute_platform_finance_summary() -> dict:
    """Compute live Admin platform-wide commission, payout, hold, and refund KPIs."""
    now = timezone.now()
    comm_gross = (
        LedgerEntry.objects.filter(
            entry_type=LedgerEntry.EntryType.PLATFORM_COMMISSION
        ).aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )
    comm_rev = (
        LedgerEntry.objects.filter(
            entry_type=LedgerEntry.EntryType.COMMISSION_REVERSAL
        ).aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )
    net_commission = max(Decimal("0.00"), comm_gross - comm_rev)

    total_seller_credits = (
        LedgerEntry.objects.filter(
            entry_type=LedgerEntry.EntryType.SALE_CREDIT
        ).aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )
    held_credits = (
        LedgerEntry.objects.filter(
            entry_type=LedgerEntry.EntryType.SALE_CREDIT,
            available_at__gt=now,
        ).aggregate(total=Sum("amount"))["total"]
        or Decimal("0.00")
    )

    pending_payouts_qs = SellerPayout.objects.filter(
        status__in=[SellerPayout.Status.REQUESTED, SellerPayout.Status.PROCESSING]
    )
    pending_payouts_count = pending_payouts_qs.count()
    pending_payouts_amount = (
        pending_payouts_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    )

    paid_payouts_amount = (
        SellerPayout.objects.filter(status=SellerPayout.Status.PAID).aggregate(
            total=Sum("amount")
        )["total"]
        or Decimal("0.00")
    )

    pending_refunds_qs = RefundRecord.objects.filter(status=RefundRecord.Status.PENDING)
    pending_refunds_count = pending_refunds_qs.count()
    pending_refunds_amount = (
        pending_refunds_qs.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
    )

    processed_refunds_amount = (
        RefundRecord.objects.filter(status=RefundRecord.Status.PROCESSED).aggregate(
            total=Sum("amount")
        )["total"]
        or Decimal("0.00")
    )

    return {
        "currency": "INR",
        "settlement_hold_days": get_settlement_hold_days(),
        "net_platform_commission": f"{quantize_inr(net_commission):.2f}",
        "total_seller_credits": f"{quantize_inr(total_seller_credits):.2f}",
        "held_settlement_amount": f"{quantize_inr(held_credits):.2f}",
        "pending_payouts_count": pending_payouts_count,
        "pending_payouts_amount": f"{quantize_inr(pending_payouts_amount):.2f}",
        "paid_payouts_amount": f"{quantize_inr(paid_payouts_amount):.2f}",
        "pending_refunds_count": pending_refunds_count,
        "pending_refunds_amount": f"{quantize_inr(pending_refunds_amount):.2f}",
        "processed_refunds_amount": f"{quantize_inr(processed_refunds_amount):.2f}",
    }


# ---------------------------------------------------------------------------
# 3. Seller Payout Requests & Admin Payout / Refund / Hold Processing
# ---------------------------------------------------------------------------


@transaction.atomic
def request_seller_payout(
    *,
    seller_profile: SellerProfile,
    amount: Decimal,
    seller_notes: str = "",
    request=None,
) -> SellerPayout:
    """
    Atomically lock SellerProfile to prevent concurrent double-withdrawals, verify
    bank/IFSC details & available balance, create SellerPayout, and book PAYOUT_DEBIT.
    """
    locked_seller = SellerProfile.objects.select_for_update().get(pk=seller_profile.pk)

    if locked_seller.is_suspended:
        raise ValidationError(
            "Payout requests are disabled while your seller studio is suspended."
        )

    bank_masked = (locked_seller.bank_account_masked or "").strip()
    ifsc = (locked_seller.ifsc_code or "").strip().upper()
    if not bank_masked or not ifsc:
        raise ValidationError(
            "Please save your bank account and IFSC code in Shop Settings before requesting a payout."
        )

    payout_amount = quantize_inr(amount)
    if payout_amount < Decimal("1.00"):
        raise ValidationError(
            {"amount": ["Minimum payout request amount is ₹1.00."]}
        )

    balance = compute_seller_balance(locked_seller)
    available = balance["available_balance"]
    if payout_amount > available:
        raise ValidationError(
            {
                "amount": [
                    f"Requested ₹{payout_amount} exceeds your available balance of ₹{available}."
                ]
            }
        )

    payout = SellerPayout.objects.create(
        payout_number=_generate_unique_payout_number(),
        seller=locked_seller,
        amount=payout_amount,
        bank_account_masked=bank_masked,
        ifsc_code=ifsc,
        status=SellerPayout.Status.REQUESTED,
        seller_notes=(seller_notes or "").strip()[:300],
    )

    LedgerEntry.objects.create(
        seller=locked_seller,
        payout=payout,
        entry_type=LedgerEntry.EntryType.PAYOUT_DEBIT,
        direction=LedgerEntry.Direction.DEBIT,
        amount=payout_amount,
        available_at=timezone.now(),
        idempotency_key=f"payout-debit-{payout.id}",
        description=(
            f"Payout withdrawal {payout.payout_number} to {bank_masked} ({ifsc})"
        ),
        metadata={
            "payout_number": payout.payout_number,
            "bank_account_masked": bank_masked,
            "ifsc_code": ifsc,
        },
    )

    record_audit_log(
        actor=locked_seller.user,
        action="SELLER_PAYOUT_REQUESTED",
        target_model="SellerPayout",
        target_id=payout.id,
        summary=(
            f"{locked_seller.shop_name} requested payout {payout.payout_number} "
            f"for ₹{payout_amount} to {bank_masked} ({ifsc})"
        ),
        metadata={
            "payout_number": payout.payout_number,
            "amount": str(payout_amount),
            "ifsc_code": ifsc,
        },
        request=request,
    )

    return SellerPayout.objects.select_related("seller", "seller__user", "processed_by").get(
        pk=payout.pk
    )


ALLOWED_PAYOUT_TRANSITIONS = {
    SellerPayout.Status.REQUESTED: {
        SellerPayout.Status.PROCESSING,
        SellerPayout.Status.PAID,
        SellerPayout.Status.REJECTED,
    },
    SellerPayout.Status.PROCESSING: {
        SellerPayout.Status.PAID,
        SellerPayout.Status.REJECTED,
    },
}


@transaction.atomic
def process_admin_payout(
    *,
    admin_user,
    payout_id,
    new_status: str,
    utr_reference: str = "",
    admin_notes: str = "",
    request=None,
) -> SellerPayout:
    """
    Admin transitions a SellerPayout to PROCESSING, PAID (requiring UTR reference),
    or REJECTED (requiring reason and writing PAYOUT_REVERSAL to restore seller balance).
    """
    payout = (
        SellerPayout.objects.select_for_update(of=("self",))
        .select_related("seller")
        .filter(pk=payout_id)
        .first()
    )
    if payout is None:
        raise ValidationError("Seller payout request not found.")

    allowed = ALLOWED_PAYOUT_TRANSITIONS.get(payout.status, set())
    if new_status not in allowed:
        raise ValidationError(
            f"Cannot transition payout from {payout.status} to {new_status}."
        )

    clean_utr = (utr_reference or "").strip()[:80]
    clean_notes = (admin_notes or "").strip()[:400]

    if new_status == SellerPayout.Status.PAID and len(clean_utr) < 4:
        raise ValidationError(
            {"utr_reference": ["Enter a valid NEFT/IMPS/UTR bank reference (min 4 chars)."]}
        )

    if new_status == SellerPayout.Status.REJECTED and len(clean_notes) < 5:
        raise ValidationError(
            {"admin_notes": ["Enter a reason (min 5 chars) when rejecting a payout request."]}
        )

    now = timezone.now()
    payout.status = new_status
    if clean_utr:
        payout.utr_reference = clean_utr
    if clean_notes:
        payout.admin_notes = clean_notes

    if new_status in (SellerPayout.Status.PAID, SellerPayout.Status.REJECTED):
        payout.processed_by = admin_user
        payout.processed_at = now

    payout.save()

    if new_status == SellerPayout.Status.REJECTED:
        LedgerEntry.objects.get_or_create(
            idempotency_key=f"payout-rev-{payout.id}",
            defaults={
                "seller": payout.seller,
                "payout": payout,
                "entry_type": LedgerEntry.EntryType.PAYOUT_REVERSAL,
                "direction": LedgerEntry.Direction.CREDIT,
                "amount": payout.amount,
                "available_at": now,
                "description": (
                    f"Reversal for rejected payout {payout.payout_number}: {clean_notes[:120]}"
                ),
                "metadata": {
                    "payout_number": payout.payout_number,
                    "admin_notes": clean_notes,
                },
            },
        )

    record_audit_log(
        actor=admin_user,
        action=f"ADMIN_PAYOUT_{new_status}",
        target_model="SellerPayout",
        target_id=payout.id,
        summary=(
            f"Admin marked payout {payout.payout_number} (₹{payout.amount}) as {new_status}"
            + (f" · UTR {clean_utr}" if clean_utr else "")
        ),
        metadata={
            "payout_number": payout.payout_number,
            "new_status": new_status,
            "utr_reference": clean_utr,
            "admin_notes": clean_notes,
        },
        request=request,
    )

    return SellerPayout.objects.select_related("seller", "seller__user", "processed_by").get(
        pk=payout.pk
    )


@transaction.atomic
def process_admin_refund(
    *,
    admin_user,
    refund_id,
    new_status: str,
    gateway_refund_id: str = "",
    admin_notes: str = "",
    request=None,
) -> RefundRecord:
    """
    Admin marks a pending RefundRecord as PROCESSED (with Razorpay/NEFT reference ID)
    or FAILED, and marks the parent Order/Payment REFUNDED once total refunded covers order total.
    """
    refund = (
        RefundRecord.objects.select_for_update(of=("self",))
        .select_related("order", "buyer")
        .filter(pk=refund_id)
        .first()
    )
    if refund is None:
        raise ValidationError("Refund record not found.")

    if refund.status != RefundRecord.Status.PENDING:
        raise ValidationError(
            f"Refund {refund.refund_number} is already {refund.status} and cannot be modified."
        )

    if new_status not in (RefundRecord.Status.PROCESSED, RefundRecord.Status.FAILED):
        raise ValidationError({"status": ["Choose PROCESSED or FAILED."]})

    clean_ref = (gateway_refund_id or "").strip()[:100]
    clean_notes = (admin_notes or "").strip()[:400]

    if new_status == RefundRecord.Status.PROCESSED and len(clean_ref) < 4:
        raise ValidationError(
            {
                "gateway_refund_id": [
                    "Enter the Razorpay refund ID or bank/UPI refund reference (min 4 chars)."
                ]
            }
        )

    if new_status == RefundRecord.Status.FAILED and len(clean_notes) < 5:
        raise ValidationError(
            {"admin_notes": ["Enter failure notes (min 5 chars) when marking a refund FAILED."]}
        )

    now = timezone.now()
    refund.status = new_status
    if clean_ref:
        refund.gateway_refund_id = clean_ref
    if clean_notes:
        refund.admin_notes = clean_notes
    refund.processed_by = admin_user
    refund.processed_at = now
    refund.save()

    if new_status == RefundRecord.Status.PROCESSED:
        order = Order.objects.select_for_update().get(pk=refund.order_id)
        total_processed_for_order = (
            RefundRecord.objects.filter(
                order=order, status=RefundRecord.Status.PROCESSED
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        if total_processed_for_order >= order.total_amount:
            order.payment_status = Order.PaymentStatus.REFUNDED
            order.save(update_fields=["payment_status", "updated_at"])
            Payment.objects.filter(
                order=order, status=Payment.Status.CAPTURED
            ).update(status=Payment.Status.REFUNDED)

    record_audit_log(
        actor=admin_user,
        action=f"ADMIN_REFUND_{new_status}",
        target_model="RefundRecord",
        target_id=refund.id,
        summary=(
            f"Admin marked refund {refund.refund_number} (₹{refund.amount}) as {new_status}"
            + (f" · Ref {clean_ref}" if clean_ref else "")
        ),
        metadata={
            "refund_number": refund.refund_number,
            "new_status": new_status,
            "gateway_refund_id": clean_ref,
            "admin_notes": clean_notes,
        },
        request=request,
    )

    return RefundRecord.objects.select_related(
        "order", "suborder", "return_request", "buyer", "processed_by"
    ).get(pk=refund.pk)


@transaction.atomic
def release_ledger_hold_early(
    *,
    admin_user,
    entry_id,
    reason: str = "",
    request=None,
) -> LedgerEntry:
    """
    Admin governance override to release a SALE_CREDIT from its 7-day settlement hold
    early (making funds immediately available for seller payout withdrawal).
    """
    entry = (
        LedgerEntry.objects.select_for_update(of=("self",))
        .select_related("seller")
        .filter(pk=entry_id)
        .first()
    )
    if entry is None:
        raise ValidationError("Ledger entry not found.")

    if entry.entry_type != LedgerEntry.EntryType.SALE_CREDIT:
        raise ValidationError("Only delivered SALE_CREDIT entries have a settlement hold.")

    now = timezone.now()
    if not entry.available_at or entry.available_at <= now:
        raise ValidationError("This sale credit is already released and available for payout.")

    previous_available_at = entry.available_at.isoformat()
    entry.available_at = now
    entry.hold_released_early = True
    entry.save(update_fields=["available_at", "hold_released_early", "updated_at"])

    clean_reason = (reason or "").strip()[:240] or "Early release approved by Admin"
    record_audit_log(
        actor=admin_user,
        action="SETTLEMENT_HOLD_RELEASED",
        target_model="LedgerEntry",
        target_id=entry.id,
        summary=(
            f"Admin released ₹{entry.amount} settlement hold early for "
            f"{entry.seller.shop_name} ({clean_reason})"
        ),
        metadata={
            "seller_shop": entry.seller.shop_name,
            "amount": str(entry.amount),
            "previous_available_at": previous_available_at,
            "reason": clean_reason,
        },
        request=request,
    )

    return LedgerEntry.objects.select_related(
        "seller", "suborder", "return_request", "refund", "payout"
    ).get(pk=entry.pk)
