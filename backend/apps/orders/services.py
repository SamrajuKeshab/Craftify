"""Authoritative atomic multi-vendor checkout, stock locking, Razorpay & COD services."""
import secrets
from collections import OrderedDict
from decimal import Decimal

from django.db import transaction
from django.db.models import F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import record_audit_log
from apps.catalog.models import Inventory, InventoryTransaction
from apps.commerce.models import BuyerAddress, Cart, Coupon, CouponUsage
from apps.commerce.services import (
    evaluate_coupon_for_cart,
    evaluate_variant_availability,
    get_cod_max_amount,
    get_free_shipping_threshold,
    get_or_create_user_cart,
    get_standard_shipping_fee,
    quantize_inr,
)
from apps.orders.models import (
    Order,
    OrderItem,
    Payment,
    PaymentTransaction,
    SellerSuborder,
)
from apps.orders.razorpay_client import (
    create_razorpay_order,
    get_razorpay_credentials,
    verify_razorpay_checkout_signature,
)


def _generate_unique_order_number() -> str:
    date_part = timezone.localdate().strftime("%y%m%d")
    for _ in range(12):
        suffix = secrets.randbelow(9000) + 1000
        candidate = f"ORD{date_part}-{suffix}"
        if not Order.objects.filter(order_number=candidate).exists():
            return candidate
    return f"ORD{date_part}-{secrets.token_hex(3).upper()}"


def _snapshot_address(address: BuyerAddress) -> dict:
    return {
        "address_id": str(address.id),
        "label": address.label,
        "recipient_name": address.recipient_name,
        "phone": address.phone,
        "line1": address.line1,
        "line2": address.line2,
        "landmark": address.landmark,
        "city": address.city,
        "state": address.state,
        "pincode": address.pincode,
    }


def _allocate_proportional_shares(total: Decimal, weights: list[Decimal]) -> list[Decimal]:
    """Split an INR Decimal proportionally across sellers without losing a single paise."""
    if not weights:
        return []
    total = quantize_inr(total)
    weight_sum = sum(weights, Decimal("0.00"))
    if total <= Decimal("0.00") or weight_sum <= Decimal("0.00"):
        return [Decimal("0.00") for _ in weights]

    shares: list[Decimal] = []
    allocated = Decimal("0.00")
    for idx, weight in enumerate(weights):
        if idx == len(weights) - 1:
            share = quantize_inr(max(Decimal("0.00"), total - allocated))
        else:
            share = quantize_inr((total * weight) / weight_sum)
            allocated += share
        shares.append(share)
    return shares


def _sync_parent_order_status(order: Order) -> None:
    """Recompute parent Order.overall_status from its child SellerSuborders."""
    if order.overall_status in (
        Order.OverallStatus.PENDING_PAYMENT,
        Order.OverallStatus.PAYMENT_FAILED,
    ):
        return

    statuses = list(order.suborders.values_list("fulfilment_status", flat=True))
    if not statuses:
        return

    if all(s == SellerSuborder.FulfilmentStatus.CANCELLED for s in statuses):
        next_status = Order.OverallStatus.CANCELLED
    elif all(s == SellerSuborder.FulfilmentStatus.DELIVERED for s in statuses):
        next_status = Order.OverallStatus.DELIVERED
    elif any(s == SellerSuborder.FulfilmentStatus.DELIVERED for s in statuses):
        next_status = Order.OverallStatus.PARTIALLY_DELIVERED
    elif any(s == SellerSuborder.FulfilmentStatus.SHIPPED for s in statuses):
        next_status = Order.OverallStatus.SHIPPED
    elif any(
        s in (SellerSuborder.FulfilmentStatus.ACCEPTED, SellerSuborder.FulfilmentStatus.PACKED)
        for s in statuses
    ):
        next_status = Order.OverallStatus.PROCESSING
    else:
        next_status = Order.OverallStatus.CONFIRMED

    if order.overall_status != next_status:
        order.overall_status = next_status
        order.save(update_fields=["overall_status", "updated_at"])


def _release_or_restock_suborder_items(
    *, suborders: list[SellerSuborder], stock_state: str, note: str
) -> None:
    """Atomically release RESERVED stock or restock DEDUCTED stock in deterministic ID order."""
    variant_qty_map: dict = {}
    for sub in suborders:
        for item in sub.items.all():
            if item.variant_id:
                variant_qty_map[item.variant_id] = (
                    variant_qty_map.get(item.variant_id, 0) + item.quantity
                )

    if not variant_qty_map:
        return

    inventories = list(
        Inventory.objects.select_for_update()
        .filter(variant_id__in=list(variant_qty_map.keys()))
        .order_by("id")
    )

    for inv in inventories:
        qty = variant_qty_map.get(inv.variant_id, 0)
        if qty <= 0:
            continue
        inv.quantity_available += qty
        if stock_state == "RESERVED":
            inv.quantity_reserved = max(0, inv.quantity_reserved - qty)
            change_type = InventoryTransaction.ChangeType.RELEASE
        else:
            change_type = InventoryTransaction.ChangeType.RETURN
        inv.save(update_fields=["quantity_available", "quantity_reserved", "updated_at"])
        InventoryTransaction.objects.create(
            inventory=inv,
            change_type=change_type,
            quantity_delta=qty,
            note=note[:255],
        )


def _commit_reserved_stock_for_order(order: Order) -> None:
    """Convert RESERVED inventory into final DEDUCTED state once Razorpay payment captures."""
    if order.stock_state != "RESERVED":
        return

    variant_qty_map: dict = {}
    for sub in order.suborders.prefetch_related("items").all():
        for item in sub.items.all():
            if item.variant_id:
                variant_qty_map[item.variant_id] = (
                    variant_qty_map.get(item.variant_id, 0) + item.quantity
                )

    if variant_qty_map:
        inventories = list(
            Inventory.objects.select_for_update()
            .filter(variant_id__in=list(variant_qty_map.keys()))
            .order_by("id")
        )
        for inv in inventories:
            qty = variant_qty_map.get(inv.variant_id, 0)
            if qty <= 0:
                continue
            inv.quantity_reserved = max(0, inv.quantity_reserved - qty)
            inv.save(update_fields=["quantity_reserved", "updated_at"])
            InventoryTransaction.objects.create(
                inventory=inv,
                change_type=InventoryTransaction.ChangeType.DEDUCT,
                quantity_delta=0,
                note=f"Razorpay payment captured for {order.order_number} (qty {qty})",
            )

    order.stock_state = "DEDUCTED"
    order.save(update_fields=["stock_state", "updated_at"])


def _record_coupon_redemption(order: Order) -> None:
    """Idempotently record CouponUsage and increment used_count once an order is confirmed."""
    if not order.coupon_id or order.discount_amount <= Decimal("0.00"):
        return
    if CouponUsage.objects.filter(
        coupon_id=order.coupon_id,
        user_id=order.buyer_id,
        order_reference=order.order_number,
    ).exists():
        return

    Coupon.objects.select_for_update().filter(pk=order.coupon_id).update(
        used_count=F("used_count") + 1
    )
    CouponUsage.objects.create(
        coupon_id=order.coupon_id,
        user_id=order.buyer_id,
        order_reference=order.order_number,
        discount_applied=order.discount_amount,
    )


def _clear_buyer_cart(user) -> None:
    cart = Cart.objects.filter(user=user).first()
    if cart:
        cart.items.all().delete()
        if cart.applied_coupon_id:
            cart.applied_coupon = None
            cart.save(update_fields=["applied_coupon", "updated_at"])


@transaction.atomic
def create_checkout_order(
    *,
    user,
    address_id,
    payment_method: str,
    idempotency_key: str | None = None,
    request=None,
) -> tuple[Order, dict | None]:
    """
    Atomically lock inventory rows (ordered by id to prevent deadlocks), validate cart,
    enforce COD ₹5,000 cap, create parent Order + split SellerSuborders + OrderItems,
    and either finalize COD or initialize a Razorpay Order.
    """
    payment_method = payment_method.upper()
    if payment_method not in (Order.PaymentMethod.COD, Order.PaymentMethod.RAZORPAY):
        raise ValidationError({"payment_method": ["Choose either RAZORPAY or COD."]})

    # Idempotency replay protection for duplicate checkout clicks
    if idempotency_key:
        existing_order = (
            Order.objects.filter(buyer=user, idempotency_key=idempotency_key)
            .prefetch_related("suborders__items", "payments")
            .first()
        )
        if existing_order:
            rzp_payload = None
            if existing_order.payment_method == Order.PaymentMethod.RAZORPAY:
                pay = existing_order.payments.first()
                if pay and pay.razorpay_order_id and existing_order.payment_status == Order.PaymentStatus.PENDING:
                    key_id, _ = get_razorpay_credentials()
                    rzp_payload = {
                        "razorpay_order_id": pay.razorpay_order_id,
                        "amount_paise": int(existing_order.total_amount * 100),
                        "currency": existing_order.currency,
                        "key_id": key_id,
                    }
            return existing_order, rzp_payload

    # Fail fast before locking DB if Razorpay keys aren't configured
    if payment_method == Order.PaymentMethod.RAZORPAY:
        get_razorpay_credentials()

    address = get_object_or_404(BuyerAddress, pk=address_id, user=user)
    cart = get_or_create_user_cart(user)

    cart_items = list(
        cart.items.select_related(
            "variant",
            "variant__inventory",
            "variant__product",
            "variant__product__category",
            "variant__product__seller",
        )
        .prefetch_related("variant__product__images")
        .order_by("created_at")
    )
    if not cart_items:
        raise ValidationError("Your cart is empty. Add handmade crafts before checking out.")

    # Deadlock-free atomic row locking on Inventory ordered by primary key
    variant_ids = [ci.variant_id for ci in cart_items]
    locked_inventories = {
        inv.variant_id: inv
        for inv in Inventory.objects.select_for_update()
        .filter(variant_id__in=variant_ids)
        .order_by("id")
    }

    # Validate every cart item against locked inventory and live approval status
    seller_groups: OrderedDict = OrderedDict()
    subtotal = Decimal("0.00")

    for ci in cart_items:
        variant = ci.variant
        inv = locked_inventories.get(variant.id)
        if inv is None:
            raise ValidationError(
                f'"{variant.product.title}" currently has no inventory record.'
            )
        # Attach freshly locked inventory so availability check reads locked row
        variant.inventory = inv
        is_ok, reason, _ = evaluate_variant_availability(variant, ci.quantity)
        if not is_ok:
            raise ValidationError(f'"{variant.product.title}" ({variant.label}): {reason}')

        unit_price = quantize_inr(variant.effective_price)
        line_total = quantize_inr(unit_price * ci.quantity)
        subtotal += line_total

        imgs = list(variant.product.images.all())
        primary_img = next((img.image_url for img in imgs if img.is_primary), "")
        if not primary_img and imgs:
            primary_img = imgs[0].image_url

        seller_id = variant.product.seller_id
        if seller_id not in seller_groups:
            seller_groups[seller_id] = {
                "seller": variant.product.seller,
                "subtotal": Decimal("0.00"),
                "lines": [],
            }
        seller_groups[seller_id]["subtotal"] += line_total
        seller_groups[seller_id]["lines"].append(
            {
                "cart_item": ci,
                "variant": variant,
                "inventory": inv,
                "unit_price": unit_price,
                "line_total": line_total,
                "image_url": primary_img,
                "commission_rate": variant.product.category.commission_rate,
            }
        )

    subtotal = quantize_inr(subtotal)

    # Lock & re-verify applied Coupon inside atomic transaction
    coupon = None
    discount_amount = Decimal("0.00")
    if cart.applied_coupon_id:
        locked_coupon = (
            Coupon.objects.select_for_update().filter(pk=cart.applied_coupon_id).first()
        )
        if locked_coupon:
            ok, calc_discount, msg = evaluate_coupon_for_cart(
                coupon=locked_coupon,
                user=user,
                subtotal=subtotal,
            )
            if not ok:
                raise ValidationError({"coupon": [msg]})
            coupon = locked_coupon
            discount_amount = calc_discount

    free_threshold = get_free_shipping_threshold()
    std_shipping = get_standard_shipping_fee()
    shipping_amount = (
        Decimal("0.00") if subtotal >= free_threshold else quantize_inr(std_shipping)
    )
    total_amount = quantize_inr(max(Decimal("0.00"), subtotal - discount_amount + shipping_amount))

    # Authoritative server-side COD ₹5,000 cap
    cod_max = get_cod_max_amount()
    if payment_method == Order.PaymentMethod.COD and total_amount > cod_max:
        raise ValidationError(
            {
                "payment_method": [
                    f"Cash on Delivery is available for orders up to ₹{cod_max:,.2f}. "
                    f"Your order total is ₹{total_amount:,.2f} — please pay via Razorpay."
                ]
            }
        )

    order_number = _generate_unique_order_number()
    is_cod = payment_method == Order.PaymentMethod.COD

    order = Order.objects.create(
        order_number=order_number,
        buyer=user,
        shipping_address_snapshot=_snapshot_address(address),
        coupon=coupon,
        coupon_code_snapshot=coupon.code if coupon else "",
        currency="INR",
        subtotal_amount=subtotal,
        discount_amount=discount_amount,
        shipping_amount=shipping_amount,
        total_amount=total_amount,
        payment_method=payment_method,
        payment_status=(
            Order.PaymentStatus.COD_PENDING if is_cod else Order.PaymentStatus.PENDING
        ),
        overall_status=(
            Order.OverallStatus.CONFIRMED if is_cod else Order.OverallStatus.PENDING_PAYMENT
        ),
        idempotency_key=idempotency_key or None,
        stock_state="DEDUCTED" if is_cod else "RESERVED",
    )

    # Proportional INR split across distinct artisan studios (zero paise drift)
    group_list = list(seller_groups.values())
    group_subtotals = [g["subtotal"] for g in group_list]
    discount_shares = _allocate_proportional_shares(discount_amount, group_subtotals)
    shipping_shares = _allocate_proportional_shares(shipping_amount, group_subtotals)

    for idx, group in enumerate(group_list):
        sub_subtotal = quantize_inr(group["subtotal"])
        sub_discount = discount_shares[idx]
        sub_shipping = shipping_shares[idx]

        # Split suborder discount across its line items to compute exact category commission
        line_totals = [line["line_total"] for line in group["lines"]]
        line_discounts = _allocate_proportional_shares(sub_discount, line_totals)

        sub_commission = Decimal("0.00")
        for line_idx, line in enumerate(group["lines"]):
            taxable_net = max(Decimal("0.00"), line["line_total"] - line_discounts[line_idx])
            item_comm = quantize_inr(
                (taxable_net * line["commission_rate"]) / Decimal("100.00")
            )
            sub_commission += item_comm

        sub_commission = quantize_inr(sub_commission)
        net_seller_amount = quantize_inr(
            max(Decimal("0.00"), sub_subtotal - sub_discount - sub_commission)
        )

        suborder = SellerSuborder.objects.create(
            parent_order=order,
            seller=group["seller"],
            suborder_number=f"{order_number}-S{idx + 1}",
            seller_shop_name_snapshot=group["seller"].shop_name,
            subtotal_amount=sub_subtotal,
            discount_share=sub_discount,
            shipping_share=sub_shipping,
            commission_amount=sub_commission,
            net_seller_amount=net_seller_amount,
            fulfilment_status=(
                SellerSuborder.FulfilmentStatus.PENDING
                if is_cod
                else SellerSuborder.FulfilmentStatus.PENDING_PAYMENT
            ),
        )

        for line in group["lines"]:
            variant = line["variant"]
            ci = line["cart_item"]
            inv = line["inventory"]

            OrderItem.objects.create(
                suborder=suborder,
                product=variant.product,
                variant=variant,
                product_title_snapshot=variant.product.title,
                product_slug_snapshot=variant.product.slug,
                product_image_snapshot=line["image_url"],
                variant_label_snapshot=variant.label or "Standard",
                variant_sku_snapshot=variant.sku,
                unit_price_snapshot=line["unit_price"],
                commission_rate_snapshot=line["commission_rate"],
                quantity=ci.quantity,
                line_total=line["line_total"],
                customization_note=ci.customization_note,
            )

            # Atomic stock update & immutable InventoryTransaction entry
            inv.quantity_available -= ci.quantity
            if is_cod:
                inv.save(update_fields=["quantity_available", "updated_at"])
                InventoryTransaction.objects.create(
                    inventory=inv,
                    change_type=InventoryTransaction.ChangeType.DEDUCT,
                    quantity_delta=-ci.quantity,
                    note=f"COD order {order_number} ({suborder.suborder_number})",
                )
            else:
                inv.quantity_reserved += ci.quantity
                inv.save(
                    update_fields=["quantity_available", "quantity_reserved", "updated_at"]
                )
                InventoryTransaction.objects.create(
                    inventory=inv,
                    change_type=InventoryTransaction.ChangeType.RESERVE,
                    quantity_delta=-ci.quantity,
                    note=f"Reserved for Razorpay checkout {order_number}",
                )

    razorpay_payload = None
    if is_cod:
        payment = Payment.objects.create(
            order=order,
            provider=Payment.Provider.COD,
            amount=total_amount,
            currency="INR",
            status=Payment.Status.COD_PENDING,
        )
        PaymentTransaction.objects.create(
            payment=payment,
            idempotency_key=f"cod-init-{order.id}",
            event_type="COD_CONFIRMED",
            raw_payload={"order_number": order_number, "amount": str(total_amount)},
        )
        _record_coupon_redemption(order)
        _clear_buyer_cart(user)

        record_audit_log(
            actor=user,
            action="ORDER_PLACED_COD",
            target_model="Order",
            target_id=order.id,
            summary=f"Placed COD order {order_number} (₹{total_amount}) across {len(group_list)} studio(s)",
            metadata={
                "order_number": order_number,
                "total_amount": str(total_amount),
                "suborder_count": len(group_list),
            },
            request=request,
        )
    else:
        amount_paise = int((total_amount * Decimal("100")).to_integral_value())
        razorpay_payload = create_razorpay_order(
            amount_paise=amount_paise,
            receipt=order_number,
            notes={
                "craftify_order_number": order_number,
                "buyer_username": user.username,
            },
        )
        payment = Payment.objects.create(
            order=order,
            provider=Payment.Provider.RAZORPAY,
            razorpay_order_id=razorpay_payload["razorpay_order_id"],
            amount=total_amount,
            currency="INR",
            status=Payment.Status.CREATED,
        )
        PaymentTransaction.objects.create(
            payment=payment,
            idempotency_key=f"rzp-init-{razorpay_payload['razorpay_order_id']}",
            event_type="RAZORPAY_ORDER_CREATED",
            raw_payload={
                "order_number": order_number,
                "razorpay_order_id": razorpay_payload["razorpay_order_id"],
                "amount_paise": amount_paise,
            },
        )

    order = (
        Order.objects.prefetch_related("suborders__items", "payments")
        .select_related("buyer")
        .get(pk=order.pk)
    )
    return order, razorpay_payload


@transaction.atomic
def finalize_razorpay_payment_capture(
    *,
    payment: Payment,
    razorpay_payment_id: str,
    event_type: str,
    idempotency_key: str,
    webhook_event_id: str | None = None,
    raw_payload: dict | None = None,
    actor=None,
    request=None,
) -> Order:
    """Idempotently capture Razorpay payment, confirm suborders, commit stock, and clear cart."""
    payment = Payment.objects.select_for_update().select_related("order").get(pk=payment.pk)
    order = Order.objects.select_for_update().get(pk=payment.order_id)

    if payment.status == Payment.Status.CAPTURED and order.payment_status == Order.PaymentStatus.PAID:
        return (
            Order.objects.prefetch_related("suborders__items", "payments")
            .select_related("buyer")
            .get(pk=order.pk)
        )

    if webhook_event_id and PaymentTransaction.objects.filter(
        webhook_event_id=webhook_event_id
    ).exists():
        return (
            Order.objects.prefetch_related("suborders__items", "payments")
            .select_related("buyer")
            .get(pk=order.pk)
        )

    payment.razorpay_payment_id = razorpay_payment_id
    payment.status = Payment.Status.CAPTURED
    payment.failure_reason = ""
    payment.save(update_fields=["razorpay_payment_id", "status", "failure_reason", "updated_at"])

    PaymentTransaction.objects.get_or_create(
        idempotency_key=idempotency_key,
        defaults={
            "payment": payment,
            "webhook_event_id": webhook_event_id,
            "event_type": event_type,
            "raw_payload": raw_payload or {},
        },
    )

    order.payment_status = Order.PaymentStatus.PAID
    order.overall_status = Order.OverallStatus.CONFIRMED
    order.save(update_fields=["payment_status", "overall_status", "updated_at"])

    order.suborders.filter(
        fulfilment_status=SellerSuborder.FulfilmentStatus.PENDING_PAYMENT
    ).update(fulfilment_status=SellerSuborder.FulfilmentStatus.PENDING)

    _commit_reserved_stock_for_order(order)
    _record_coupon_redemption(order)
    _clear_buyer_cart(order.buyer)

    record_audit_log(
        actor=actor or order.buyer,
        action="ORDER_PAID_RAZORPAY",
        target_model="Order",
        target_id=order.id,
        summary=f"Verified Razorpay payment {razorpay_payment_id} for {order.order_number} (₹{order.total_amount})",
        metadata={
            "order_number": order.order_number,
            "razorpay_order_id": payment.razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "total_amount": str(order.total_amount),
        },
        request=request,
    )

    return (
        Order.objects.prefetch_related("suborders__items", "payments")
        .select_related("buyer")
        .get(pk=order.pk)
    )


@transaction.atomic
def verify_razorpay_payment_for_buyer(
    *,
    user,
    order_id,
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
    request=None,
) -> Order:
    """Verify HMAC-SHA256 Razorpay signature server-side and finalize the buyer's order."""
    order = get_object_or_404(Order, pk=order_id, buyer=user)
    payment = get_object_or_404(
        Payment,
        order=order,
        provider=Payment.Provider.RAZORPAY,
        razorpay_order_id=razorpay_order_id,
    )

    if not verify_razorpay_checkout_signature(
        razorpay_order_id=razorpay_order_id,
        razorpay_payment_id=razorpay_payment_id,
        razorpay_signature=razorpay_signature,
    ):
        PaymentTransaction.objects.get_or_create(
            idempotency_key=f"rzp-bad-sig-{razorpay_order_id}-{secrets.token_hex(4)}",
            defaults={
                "payment": payment,
                "event_type": "SIGNATURE_VERIFICATION_FAILED",
                "raw_payload": {
                    "razorpay_order_id": razorpay_order_id,
                    "razorpay_payment_id": razorpay_payment_id,
                },
            },
        )
        raise ValidationError(
            "Razorpay payment signature verification failed. Order was not confirmed."
        )

    return finalize_razorpay_payment_capture(
        payment=payment,
        razorpay_payment_id=razorpay_payment_id,
        event_type="RAZORPAY_SIGNATURE_VERIFIED",
        idempotency_key=f"rzp-verify-{razorpay_payment_id}",
        raw_payload={
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
        },
        actor=user,
        request=request,
    )


@transaction.atomic
def release_failed_razorpay_order(
    *,
    payment: Payment,
    reason: str = "Payment cancelled or failed",
    event_type: str = "RAZORPAY_PAYMENT_FAILED",
    idempotency_key: str | None = None,
    webhook_event_id: str | None = None,
    raw_payload: dict | None = None,
) -> Order:
    """Atomically release reserved stock if a Razorpay checkout fails or is abandoned."""
    payment = Payment.objects.select_for_update().select_related("order").get(pk=payment.pk)
    order = Order.objects.select_for_update().get(pk=payment.order_id)

    if order.payment_status == Order.PaymentStatus.PAID:
        return (
            Order.objects.prefetch_related("suborders__items", "payments")
            .select_related("buyer")
            .get(pk=order.pk)
        )

    if order.stock_state == "RESERVED":
        suborders = list(order.suborders.prefetch_related("items").all())
        _release_or_restock_suborder_items(
            suborders=suborders,
            stock_state="RESERVED",
            note=f"Released reserved stock for failed payment on {order.order_number}",
        )
        order.stock_state = "RELEASED"

    payment.status = Payment.Status.FAILED
    payment.failure_reason = (reason or "Payment failed")[:255]
    payment.save(update_fields=["status", "failure_reason", "updated_at"])

    order.payment_status = Order.PaymentStatus.FAILED
    order.overall_status = Order.OverallStatus.PAYMENT_FAILED
    order.save(update_fields=["payment_status", "overall_status", "stock_state", "updated_at"])

    order.suborders.update(fulfilment_status=SellerSuborder.FulfilmentStatus.CANCELLED)

    PaymentTransaction.objects.get_or_create(
        idempotency_key=idempotency_key or f"rzp-fail-{payment.id}",
        defaults={
            "payment": payment,
            "webhook_event_id": webhook_event_id,
            "event_type": event_type,
            "raw_payload": raw_payload or {"reason": payment.failure_reason},
        },
    )

    return (
        Order.objects.prefetch_related("suborders__items", "payments")
        .select_related("buyer")
        .get(pk=order.pk)
    )


@transaction.atomic
def cancel_buyer_order(*, user, order_id, request=None) -> Order:
    """Allow buyer to cancel their own order before any suborder is packed/shipped."""
    order = (
        Order.objects.select_for_update()
        .prefetch_related("suborders__items", "payments")
        .filter(pk=order_id, buyer=user)
        .first()
    )
    if order is None:
        raise ValidationError("Order not found.")

    if order.overall_status in (
        Order.OverallStatus.CANCELLED,
        Order.OverallStatus.PAYMENT_FAILED,
    ):
        raise ValidationError("This order is already cancelled.")

    suborders = list(order.suborders.all())
    non_cancellable = {
        SellerSuborder.FulfilmentStatus.PACKED,
        SellerSuborder.FulfilmentStatus.SHIPPED,
        SellerSuborder.FulfilmentStatus.DELIVERED,
    }
    if any(sub.fulfilment_status in non_cancellable for sub in suborders):
        raise ValidationError(
            "This order can no longer be cancelled because an artisan studio has already packed or shipped it."
        )

    if order.stock_state in ("RESERVED", "DEDUCTED"):
        _release_or_restock_suborder_items(
            suborders=suborders,
            stock_state=order.stock_state,
            note=f"Buyer cancelled order {order.order_number}",
        )
        order.stock_state = "RELEASED"

    order.suborders.update(fulfilment_status=SellerSuborder.FulfilmentStatus.CANCELLED)
    order.overall_status = Order.OverallStatus.CANCELLED
    if order.payment_status == Order.PaymentStatus.PENDING:
        order.payment_status = Order.PaymentStatus.FAILED
    order.save(update_fields=["overall_status", "payment_status", "stock_state", "updated_at"])

    record_audit_log(
        actor=user,
        action="ORDER_CANCELLED_BY_BUYER",
        target_model="Order",
        target_id=order.id,
        summary=f"Buyer cancelled order {order.order_number} and restored stock",
        metadata={"order_number": order.order_number},
        request=request,
    )

    return (
        Order.objects.prefetch_related("suborders__items", "payments")
        .select_related("buyer")
        .get(pk=order.pk)
    )


ALLOWED_SELLER_TRANSITIONS = {
    SellerSuborder.FulfilmentStatus.PENDING: {
        SellerSuborder.FulfilmentStatus.ACCEPTED,
        SellerSuborder.FulfilmentStatus.CANCELLED,
    },
    SellerSuborder.FulfilmentStatus.ACCEPTED: {
        SellerSuborder.FulfilmentStatus.PACKED,
        SellerSuborder.FulfilmentStatus.CANCELLED,
    },
}


@transaction.atomic
def update_seller_suborder_status(
    *, seller_profile, suborder_id, new_status: str, seller_notes: str = "", request=None
) -> SellerSuborder:
    """Allow an approved Seller to accept, pack, or cancel strictly their OWN suborder."""
    suborder = (
        SellerSuborder.objects.select_for_update()
        .select_related("parent_order", "seller")
        .prefetch_related("items")
        .filter(pk=suborder_id, seller=seller_profile)
        .first()
    )
    if suborder is None:
        raise ValidationError("Suborder not found for your studio.")

    allowed = ALLOWED_SELLER_TRANSITIONS.get(suborder.fulfilment_status, set())
    if new_status not in allowed:
        raise ValidationError(
            f"Cannot change suborder status from {suborder.fulfilment_status} to {new_status}."
        )

    if new_status == SellerSuborder.FulfilmentStatus.CANCELLED:
        _release_or_restock_suborder_items(
            suborders=[suborder],
            stock_state=suborder.parent_order.stock_state,
            note=f"Seller studio cancelled suborder {suborder.suborder_number}",
        )

    suborder.fulfilment_status = new_status
    if seller_notes is not None and seller_notes.strip():
        suborder.seller_notes = seller_notes.strip()[:300]
    suborder.save(update_fields=["fulfilment_status", "seller_notes", "updated_at"])

    _sync_parent_order_status(suborder.parent_order)

    record_audit_log(
        actor=seller_profile.user,
        action="SUBORDER_STATUS_UPDATED",
        target_model="SellerSuborder",
        target_id=suborder.id,
        summary=f"{seller_profile.shop_name} marked {suborder.suborder_number} as {new_status}",
        metadata={
            "suborder_number": suborder.suborder_number,
            "new_status": new_status,
        },
        request=request,
    )

    return suborder
