"""Authoritative transactional services for Courier Dispatch, Tracking Events & 7-Day Returns."""
import secrets
from datetime import timedelta
from decimal import Decimal
from urllib.parse import urlparse

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import record_audit_log
from apps.catalog.models import Inventory, InventoryTransaction
from apps.commerce.services import quantize_inr
from apps.orders.models import Order, OrderItem, Payment, PaymentTransaction, SellerSuborder
from apps.orders.services import _sync_parent_order_status
from apps.shipping.models import ReturnRequest, Shipment, ShipmentEvent
from common.cloudinary_utils import upload_image_to_cloudinary

INDIAN_COURIERS = [
    "Delhivery",
    "India Post",
    "Blue Dart",
    "DTDC",
    "Xpressbees",
    "Shadowfax",
    "Ecom Express",
    "Ekart Logistics",
]

MAX_RETURN_EVIDENCE_IMAGES = 3
DEFECT_ONLY_REASONS = {
    ReturnRequest.Reason.DAMAGED,
    ReturnRequest.Reason.DEFECTIVE,
    ReturnRequest.Reason.WRONG_ITEM,
}


def get_return_window_days() -> int:
    return int(getattr(settings, "CRAFTIFY_RETURN_WINDOW_DAYS", 7))


def validate_safe_tracking_url(raw_url: str) -> str:
    url = (raw_url or "").strip()
    if not url:
        return ""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValidationError(
            {"tracking_url": ["Tracking link must start with http:// or https://."]}
        )
    return url


def _generate_unique_return_number() -> str:
    date_part = timezone.localdate().strftime("%y%m%d")
    for _ in range(12):
        suffix = secrets.randbelow(9000) + 1000
        candidate = f"RET{date_part}-{suffix}"
        if not ReturnRequest.objects.filter(return_number=candidate).exists():
            return candidate
    return f"RET{date_part}-{secrets.token_hex(3).upper()}"


def is_order_item_restricted_return(order_item: OrderItem) -> bool:
    """
    Personalized or made-to-order crafts are returnable ONLY if damaged,
    defective, or wrong item received.
    """
    if (order_item.customization_note or "").strip():
        return True
    product = order_item.product
    if product and (product.is_made_to_order or product.is_customizable):
        return True
    return False


def get_suborder_return_window_info(suborder: SellerSuborder) -> tuple:
    """Return (window_ends_at_datetime_or_None, is_eligible_bool)."""
    if (
        suborder.fulfilment_status != SellerSuborder.FulfilmentStatus.DELIVERED
        or not suborder.delivered_at
    ):
        return None, False
    ends_at = suborder.delivered_at + timedelta(days=get_return_window_days())
    return ends_at, timezone.now() <= ends_at


# ---------------------------------------------------------------------------
# 1. Seller Courier Dispatch, Tracking Milestones & Delivery Confirmation
# ---------------------------------------------------------------------------


@transaction.atomic
def dispatch_seller_suborder(
    *,
    seller_profile,
    suborder_id,
    courier_name: str,
    tracking_number: str,
    tracking_url: str = "",
    estimated_delivery_date=None,
    dispatch_notes: str = "",
    request=None,
) -> SellerSuborder:
    """Transition a PACKED SellerSuborder to SHIPPED with Indian courier & AWB tracking."""
    suborder = (
        SellerSuborder.objects.select_for_update(of=("self",))
        .select_related("parent_order", "seller")
        .prefetch_related("items")
        .filter(pk=suborder_id, seller=seller_profile)
        .first()
    )
    if suborder is None:
        raise ValidationError("Suborder not found for your studio.")

    if suborder.fulfilment_status != SellerSuborder.FulfilmentStatus.PACKED:
        raise ValidationError(
            "Only PACKED suborders can be dispatched. Mark the suborder as Packed first."
        )

    if Shipment.objects.filter(suborder=suborder).exists():
        raise ValidationError("A shipment has already been created for this suborder.")

    clean_courier = (courier_name or "").strip()
    clean_tracking = (tracking_number or "").strip()
    if not clean_courier:
        raise ValidationError({"courier_name": ["Please select or enter a courier name."]})
    if len(clean_tracking) < 4:
        raise ValidationError(
            {"tracking_number": ["Enter a valid courier AWB / tracking number (min 4 chars)."]}
        )

    safe_url = validate_safe_tracking_url(tracking_url)
    now = timezone.now()

    shipment = Shipment.objects.create(
        suborder=suborder,
        courier_name=clean_courier[:80],
        tracking_number=clean_tracking[:100],
        tracking_url=safe_url,
        current_status=Shipment.Status.DISPATCHED,
        shipped_at=now,
        estimated_delivery_date=estimated_delivery_date,
        dispatch_notes=(dispatch_notes or "").strip()[:300],
    )

    origin_city = ", ".join(
        part for part in [seller_profile.city, seller_profile.state] if part
    )
    ShipmentEvent.objects.create(
        shipment=shipment,
        status=Shipment.Status.DISPATCHED,
        location=origin_city or "Artisan Studio",
        notes=(dispatch_notes or "").strip()[:300]
        or f"Handed over to {shipment.courier_name} (AWB {shipment.tracking_number})",
        event_timestamp=now,
    )

    suborder.fulfilment_status = SellerSuborder.FulfilmentStatus.SHIPPED
    suborder.save(update_fields=["fulfilment_status", "updated_at"])
    _sync_parent_order_status(suborder.parent_order)

    record_audit_log(
        actor=seller_profile.user,
        action="SUBORDER_SHIPPED",
        target_model="Shipment",
        target_id=shipment.id,
        summary=(
            f"{seller_profile.shop_name} dispatched {suborder.suborder_number} "
            f"via {shipment.courier_name} ({shipment.tracking_number})"
        ),
        metadata={
            "suborder_number": suborder.suborder_number,
            "courier_name": shipment.courier_name,
            "tracking_number": shipment.tracking_number,
        },
        request=request,
    )

    return (
        SellerSuborder.objects.select_related(
            "parent_order", "parent_order__buyer", "seller", "shipment"
        )
        .prefetch_related("items", "shipment__events", "return_requests")
        .get(pk=suborder.pk)
    )


ALLOWED_TRANSIT_EVENT_STATUSES = {
    Shipment.Status.IN_TRANSIT,
    Shipment.Status.OUT_FOR_DELIVERY,
    Shipment.Status.DELIVERY_ATTEMPTED,
}


@transaction.atomic
def add_shipment_tracking_event(
    *,
    seller_profile,
    suborder_id,
    status: str,
    location: str = "",
    notes: str = "",
    request=None,
) -> SellerSuborder:
    """Append a chronological transit checkpoint event to an active SHIPPED suborder."""
    suborder = (
        SellerSuborder.objects.select_for_update(of=("self",))
        .select_related("parent_order", "seller")
        .filter(pk=suborder_id, seller=seller_profile)
        .first()
    )
    if suborder is None:
        raise ValidationError("Suborder not found for your studio.")

    if suborder.fulfilment_status != SellerSuborder.FulfilmentStatus.SHIPPED:
        raise ValidationError("Tracking updates can only be added to SHIPPED suborders.")

    shipment = (
        Shipment.objects.select_for_update()
        .filter(suborder=suborder)
        .first()
    )
    if shipment is None:
        raise ValidationError("No shipment record exists for this suborder.")

    if status not in ALLOWED_TRANSIT_EVENT_STATUSES:
        raise ValidationError(
            {"status": ["Choose IN_TRANSIT, OUT_FOR_DELIVERY, or DELIVERY_ATTEMPTED."]}
        )

    now = timezone.now()
    ShipmentEvent.objects.create(
        shipment=shipment,
        status=status,
        location=(location or "").strip()[:120],
        notes=(notes or "").strip()[:300],
        event_timestamp=now,
    )
    shipment.current_status = status
    shipment.save(update_fields=["current_status", "updated_at"])

    record_audit_log(
        actor=seller_profile.user,
        action="SHIPMENT_EVENT_ADDED",
        target_model="Shipment",
        target_id=shipment.id,
        summary=f"Shipment {shipment.tracking_number} updated to {status}",
        metadata={
            "suborder_number": suborder.suborder_number,
            "status": status,
            "location": (location or "").strip(),
        },
        request=request,
    )

    return (
        SellerSuborder.objects.select_related(
            "parent_order", "parent_order__buyer", "seller", "shipment"
        )
        .prefetch_related("items", "shipment__events", "return_requests")
        .get(pk=suborder.pk)
    )


@transaction.atomic
def mark_suborder_delivered(
    *,
    seller_profile,
    suborder_id,
    delivery_notes: str = "",
    request=None,
) -> SellerSuborder:
    """
    Mark a SHIPPED suborder DELIVERED, stamp authoritative delivered_at (starting the
    7-day buyer return window), and capture COD payment once all active parcels deliver.
    """
    suborder = (
        SellerSuborder.objects.select_for_update(of=("self",))
        .select_related("parent_order", "seller")
        .filter(pk=suborder_id, seller=seller_profile)
        .first()
    )
    if suborder is None:
        raise ValidationError("Suborder not found for your studio.")

    if suborder.fulfilment_status != SellerSuborder.FulfilmentStatus.SHIPPED:
        raise ValidationError("Only SHIPPED suborders can be marked as Delivered.")

    shipment = (
        Shipment.objects.select_for_update()
        .filter(suborder=suborder)
        .first()
    )
    if shipment is None:
        raise ValidationError("No shipment record exists for this suborder.")

    now = timezone.now()
    addr = suborder.parent_order.shipping_address_snapshot or {}
    dest_city = ", ".join(part for part in [addr.get("city"), addr.get("state")] if part)

    shipment.current_status = Shipment.Status.DELIVERED
    shipment.delivered_at = now
    shipment.save(update_fields=["current_status", "delivered_at", "updated_at"])

    ShipmentEvent.objects.create(
        shipment=shipment,
        status=Shipment.Status.DELIVERED,
        location=dest_city or "Buyer Delivery Address",
        notes=(delivery_notes or "").strip()[:300] or "Delivered to recipient.",
        event_timestamp=now,
    )

    suborder.fulfilment_status = SellerSuborder.FulfilmentStatus.DELIVERED
    suborder.delivered_at = now
    suborder.save(update_fields=["fulfilment_status", "delivered_at", "updated_at"])

    parent_order = Order.objects.select_for_update().get(pk=suborder.parent_order_id)
    _sync_parent_order_status(parent_order)

    # For COD orders, once every active suborder is delivered, mark COD payment CAPTURED
    if (
        parent_order.payment_method == Order.PaymentMethod.COD
        and parent_order.payment_status == Order.PaymentStatus.COD_PENDING
    ):
        active_statuses = list(
            parent_order.suborders.exclude(
                fulfilment_status=SellerSuborder.FulfilmentStatus.CANCELLED
            ).values_list("fulfilment_status", flat=True)
        )
        if active_statuses and all(
            st == SellerSuborder.FulfilmentStatus.DELIVERED for st in active_statuses
        ):
            parent_order.payment_status = Order.PaymentStatus.PAID
            parent_order.save(update_fields=["payment_status", "updated_at"])
            cod_payment = (
                Payment.objects.select_for_update()
                .filter(order=parent_order, provider=Payment.Provider.COD)
                .first()
            )
            if cod_payment and cod_payment.status != Payment.Status.CAPTURED:
                cod_payment.status = Payment.Status.CAPTURED
                cod_payment.save(update_fields=["status", "updated_at"])
                PaymentTransaction.objects.get_or_create(
                    idempotency_key=f"cod-delivered-{parent_order.id}",
                    defaults={
                        "payment": cod_payment,
                        "event_type": "COD_COLLECTED_ON_DELIVERY",
                        "raw_payload": {
                            "order_number": parent_order.order_number,
                            "delivered_at": now.isoformat(),
                        },
                    },
                )

    record_audit_log(
        actor=seller_profile.user,
        action="SUBORDER_DELIVERED",
        target_model="SellerSuborder",
        target_id=suborder.id,
        summary=(
            f"{seller_profile.shop_name} marked {suborder.suborder_number} as DELIVERED "
            f"(7-day return window open)"
        ),
        metadata={
            "suborder_number": suborder.suborder_number,
            "delivered_at": now.isoformat(),
        },
        request=request,
    )

    return (
        SellerSuborder.objects.select_related(
            "parent_order", "parent_order__buyer", "seller", "shipment"
        )
        .prefetch_related("items", "shipment__events", "return_requests")
        .get(pk=suborder.pk)
    )


# ---------------------------------------------------------------------------
# 2. Buyer 7-Day Return Requests & Direct Seller Resolution
# ---------------------------------------------------------------------------


def _compute_item_refund_amount(order_item: OrderItem, quantity: int) -> Decimal:
    """Compute exact proportional net INR refund (accounting for suborder coupon discount)."""
    suborder = order_item.suborder
    item_gross = quantize_inr(order_item.unit_price_snapshot * quantity)
    if suborder.subtotal_amount <= Decimal("0.00") or suborder.discount_share <= Decimal("0.00"):
        return item_gross
    proportional_discount = quantize_inr(
        (suborder.discount_share * item_gross) / suborder.subtotal_amount
    )
    return quantize_inr(max(Decimal("0.01"), item_gross - proportional_discount))


@transaction.atomic
def create_buyer_return_request(
    *,
    buyer,
    order_item_id,
    reason: str,
    description: str,
    quantity: int = 1,
    evidence_files=None,
    request=None,
) -> ReturnRequest:
    """
    Create a 7-day post-delivery ReturnRequest for a buyer's own delivered OrderItem,
    enforcing personalized/made-to-order restrictions and optional Cloudinary photo upload.
    """
    order_item = (
        OrderItem.objects.select_for_update(of=("self",))
        .select_related("suborder", "suborder__parent_order", "suborder__seller")
        .filter(pk=order_item_id, suborder__parent_order__buyer=buyer)
        .first()
    )
    if order_item is None:
        raise ValidationError("Order item not found for your account.")

    suborder = order_item.suborder
    if suborder.fulfilment_status != SellerSuborder.FulfilmentStatus.DELIVERED:
        raise ValidationError("Returns can only be requested after the parcel is delivered.")

    window_ends_at, is_eligible = get_suborder_return_window_info(suborder)
    if not is_eligible or window_ends_at is None:
        days = get_return_window_days()
        raise ValidationError(
            f"The {days}-day post-delivery return window has closed for this suborder."
        )

    if is_order_item_restricted_return(order_item) and reason not in DEFECT_ONLY_REASONS:
        raise ValidationError(
            {
                "reason": [
                    "Personalized or made-to-order crafts can only be returned if damaged in transit, defective, or wrong item received."
                ]
            }
        )

    clean_desc = (description or "").strip()
    if len(clean_desc) < 10:
        raise ValidationError(
            {"description": ["Please describe the issue in at least 10 characters."]}
        )

    if quantity < 1 or quantity > order_item.quantity:
        raise ValidationError(
            {"quantity": [f"Return quantity must be between 1 and {order_item.quantity}."]}
        )

    # Prevent duplicate active return requests for the same line item
    already_exists = ReturnRequest.objects.filter(
        order_item=order_item,
        status__in=[
            ReturnRequest.Status.REQUESTED,
            ReturnRequest.Status.APPROVED,
            ReturnRequest.Status.PICKED_UP,
            ReturnRequest.Status.COMPLETED,
        ],
    ).exists()
    if already_exists:
        raise ValidationError(
            "An active or completed return request already exists for this item."
        )

    evidence_files = list(evidence_files or [])
    if len(evidence_files) > MAX_RETURN_EVIDENCE_IMAGES:
        raise ValidationError(
            {
                "evidence_images": [
                    f"You can attach up to {MAX_RETURN_EVIDENCE_IMAGES} photos per return request."
                ]
            }
        )

    evidence_urls: list[str] = []
    evidence_public_ids: list[str] = []
    for img_file in evidence_files:
        uploaded = upload_image_to_cloudinary(img_file, folder="craftify/returns")
        evidence_urls.append(uploaded["image_url"])
        evidence_public_ids.append(uploaded["cloudinary_public_id"])

    refund_amount = _compute_item_refund_amount(order_item, quantity)
    ret = ReturnRequest.objects.create(
        return_number=_generate_unique_return_number(),
        suborder=suborder,
        order_item=order_item,
        buyer=buyer,
        reason=reason,
        description=clean_desc[:1000],
        evidence_urls=evidence_urls,
        evidence_public_ids=evidence_public_ids,
        quantity=quantity,
        refund_amount=refund_amount,
        status=ReturnRequest.Status.REQUESTED,
    )

    record_audit_log(
        actor=buyer,
        action="RETURN_REQUESTED",
        target_model="ReturnRequest",
        target_id=ret.id,
        summary=(
            f"Buyer requested return {ret.return_number} for {order_item.product_title_snapshot} "
            f"({ret.get_reason_display()})"
        ),
        metadata={
            "return_number": ret.return_number,
            "suborder_number": suborder.suborder_number,
            "refund_amount": str(refund_amount),
            "evidence_count": len(evidence_urls),
        },
        request=request,
    )

    return (
        ReturnRequest.objects.select_related(
            "suborder", "suborder__parent_order", "suborder__seller", "order_item", "buyer"
        ).get(pk=ret.pk)
    )


ALLOWED_RETURN_TRANSITIONS = {
    ReturnRequest.Status.REQUESTED: {
        ReturnRequest.Status.APPROVED,
        ReturnRequest.Status.REJECTED,
    },
    ReturnRequest.Status.APPROVED: {
        ReturnRequest.Status.PICKED_UP,
        ReturnRequest.Status.COMPLETED,
    },
    ReturnRequest.Status.PICKED_UP: {
        ReturnRequest.Status.COMPLETED,
    },
}


@transaction.atomic
def resolve_seller_return_request(
    *,
    seller_profile,
    return_id,
    new_status: str,
    seller_response_note: str = "",
    restock_inventory: bool = False,
    request=None,
) -> ReturnRequest:
    """
    Allow an approved Seller to directly Approve, Reject, Mark Picked Up, or Complete
    a return request strictly for their own studio suborder.
    """
    ret = (
        ReturnRequest.objects.select_for_update(of=("self",))
        .select_related(
            "suborder",
            "suborder__parent_order",
            "suborder__seller",
            "order_item",
            "buyer",
        )
        .filter(pk=return_id, suborder__seller=seller_profile)
        .first()
    )
    if ret is None:
        raise ValidationError("Return request not found for your studio.")

    allowed = ALLOWED_RETURN_TRANSITIONS.get(ret.status, set())
    if new_status not in allowed:
        raise ValidationError(
            f"Cannot transition return from {ret.status} to {new_status}."
        )

    clean_note = (seller_response_note or "").strip()[:400]
    if new_status == ReturnRequest.Status.REJECTED and len(clean_note) < 5:
        raise ValidationError(
            {
                "seller_response_note": [
                    "Please provide a clear reason (min 5 characters) when rejecting a return request."
                ]
            }
        )

    ret.status = new_status
    if clean_note:
        ret.seller_response_note = clean_note

    if new_status in (ReturnRequest.Status.COMPLETED, ReturnRequest.Status.REJECTED):
        ret.resolved_at = timezone.now()

    if new_status == ReturnRequest.Status.COMPLETED:
        if restock_inventory and not ret.restocked and ret.order_item.variant_id:
            inv = (
                Inventory.objects.select_for_update()
                .filter(variant_id=ret.order_item.variant_id)
                .first()
            )
            if inv:
                inv.quantity_available += ret.quantity
                inv.save(update_fields=["quantity_available", "updated_at"])
                InventoryTransaction.objects.create(
                    inventory=inv,
                    change_type=InventoryTransaction.ChangeType.RETURN,
                    quantity_delta=ret.quantity,
                    note=f"Restocked from completed return {ret.return_number}",
                )
                ret.restocked = True

    ret.save()

    # If every line item quantity in the suborder is now a completed return, mark suborder RETURNED
    if new_status == ReturnRequest.Status.COMPLETED:
        suborder = SellerSuborder.objects.select_for_update().get(pk=ret.suborder_id)
        total_ordered_qty = sum(
            suborder.items.values_list("quantity", flat=True)
        )
        total_returned_qty = sum(
            ReturnRequest.objects.filter(
                suborder=suborder, status=ReturnRequest.Status.COMPLETED
            ).values_list("quantity", flat=True)
        )
        if total_ordered_qty > 0 and total_returned_qty >= total_ordered_qty:
            suborder.fulfilment_status = SellerSuborder.FulfilmentStatus.RETURNED
            suborder.save(update_fields=["fulfilment_status", "updated_at"])

    record_audit_log(
        actor=seller_profile.user,
        action=f"RETURN_{new_status}",
        target_model="ReturnRequest",
        target_id=ret.id,
        summary=(
            f"{seller_profile.shop_name} marked return {ret.return_number} as {new_status}"
            + (" (restocked)" if ret.restocked and new_status == ReturnRequest.Status.COMPLETED else "")
        ),
        metadata={
            "return_number": ret.return_number,
            "new_status": new_status,
            "restocked": ret.restocked,
        },
        request=request,
    )

    return ret
