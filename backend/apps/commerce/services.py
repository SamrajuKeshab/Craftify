"""Authoritative server-side Decimal pricing, stock validation, and coupon evaluation."""
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.utils import timezone

from apps.catalog.models import Product, ProductVariant
from apps.commerce.models import Cart, Coupon, CouponUsage, Wishlist

TWO_PLACES = Decimal("0.01")
MAX_CART_ITEM_QTY = 50


def quantize_inr(amount: Decimal) -> Decimal:
    """Round any INR Decimal value to 2 decimal places using HALF_UP."""
    return Decimal(amount).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def get_free_shipping_threshold() -> Decimal:
    return Decimal(str(getattr(settings, "CRAFTIFY_FREE_SHIPPING_THRESHOLD", "999.00")))


def get_standard_shipping_fee() -> Decimal:
    return Decimal(str(getattr(settings, "CRAFTIFY_STANDARD_SHIPPING_FEE", "79.00")))


def get_cod_max_amount() -> Decimal:
    return Decimal(str(getattr(settings, "CRAFTIFY_COD_MAX_AMOUNT", "5000.00")))


def get_or_create_user_cart(user) -> Cart:
    cart, _ = Cart.objects.get_or_create(user=user)
    return cart


def get_or_create_user_wishlist(user) -> Wishlist:
    wishlist, _ = Wishlist.objects.get_or_create(user=user)
    return wishlist


def evaluate_variant_availability(variant: ProductVariant, requested_qty: int = 1) -> tuple[bool, str, int]:
    """
    Verify that a variant and its parent product/category/seller are live, approved,
    and have sufficient inventory for the requested quantity.
    Returns (is_valid, reason_message, available_stock).
    """
    product = variant.product
    if product.is_deleted or product.approval_status != Product.ApprovalStatus.APPROVED:
        return False, "This product is no longer available for purchase.", 0
    if not product.category.is_active:
        return False, "This craft's category is currently inactive.", 0
    if product.seller.is_suspended:
        return False, "This artisan studio is currently paused.", 0
    if not variant.is_active:
        return False, "This product option is no longer active.", 0

    inv = getattr(variant, "inventory", None)
    available_stock = inv.quantity_available if inv else 0
    if available_stock <= 0:
        return False, "This item is currently out of stock.", 0
    if requested_qty > available_stock:
        return (
            False,
            f"Only {available_stock} unit{'s' if available_stock != 1 else ''} left in stock.",
            available_stock,
        )
    if requested_qty > MAX_CART_ITEM_QTY:
        return False, f"Maximum {MAX_CART_ITEM_QTY} units allowed per item.", available_stock
    return True, "", available_stock


def evaluate_coupon_for_cart(*, coupon: Coupon, user, subtotal: Decimal) -> tuple[bool, Decimal, str]:
    """
    Validate a platform coupon against live server clock, usage caps, and cart subtotal.
    Returns (is_valid, discount_amount_inr, message).
    """
    now = timezone.now()

    if not coupon.is_active:
        return False, Decimal("0.00"), f"Coupon {coupon.code} is currently inactive."

    if now < coupon.valid_from:
        return (
            False,
            Decimal("0.00"),
            f"Coupon {coupon.code} is not active yet.",
        )

    if now > coupon.valid_until:
        return False, Decimal("0.00"), f"Coupon {coupon.code} has expired."

    if coupon.max_uses > 0 and coupon.used_count >= coupon.max_uses:
        return (
            False,
            Decimal("0.00"),
            f"Coupon {coupon.code} has reached its maximum redemption limit.",
        )

    if coupon.per_user_limit > 0:
        user_uses = CouponUsage.objects.filter(coupon=coupon, user=user).count()
        if user_uses >= coupon.per_user_limit:
            return (
                False,
                Decimal("0.00"),
                f"You have already used coupon {coupon.code} the maximum allowed times.",
            )

    if subtotal <= Decimal("0.00"):
        return False, Decimal("0.00"), "Add items to your cart before applying a coupon."

    if subtotal < coupon.min_order_amount:
        return (
            False,
            Decimal("0.00"),
            f"Minimum order of ₹{coupon.min_order_amount:,.2f} required for {coupon.code}.",
        )

    if coupon.discount_type == Coupon.DiscountType.PERCENT:
        raw_discount = (subtotal * coupon.value) / Decimal("100")
        discount = quantize_inr(raw_discount)
        if coupon.max_discount_amount is not None:
            discount = min(discount, coupon.max_discount_amount)
    else:
        discount = quantize_inr(coupon.value)

    # Discount can never exceed cart subtotal
    discount = min(discount, subtotal)
    discount = quantize_inr(max(Decimal("0.00"), discount))

    summary = coupon.description.strip() or (
        f"{coupon.value:.0f}% off applied"
        if coupon.discount_type == Coupon.DiscountType.PERCENT
        else f"₹{coupon.value:,.2f} off applied"
    )
    return True, discount, summary


def build_cart_payload(cart: Cart) -> dict:
    """
    Build authoritative cart summary JSON using live PostgreSQL prices, inventory,
    and coupon validation. Automatically drops stale/ineligible applied coupons.
    """
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

    serialized_items = []
    subtotal = Decimal("0.00")
    total_qty = 0
    seller_ids = set()

    for entry in cart_items:
        variant = entry.variant
        product = variant.product
        unit_price = quantize_inr(variant.effective_price)
        line_total = quantize_inr(unit_price * entry.quantity)

        is_available, availability_issue, available_stock = evaluate_variant_availability(
            variant, entry.quantity
        )

        imgs = list(product.images.all())
        primary_img = next((img.image_url for img in imgs if img.is_primary), "")
        if not primary_img and imgs:
            primary_img = imgs[0].image_url

        subtotal += line_total
        total_qty += entry.quantity
        seller_ids.add(str(product.seller_id))

        serialized_items.append(
            {
                "id": str(entry.id),
                "variant_id": str(variant.id),
                "variant_sku": variant.sku,
                "variant_label": variant.label or "Standard",
                "product_id": str(product.id),
                "product_slug": product.slug,
                "product_title": product.title,
                "category_name": product.category.name,
                "seller_id": str(product.seller_id),
                "seller_shop_name": product.seller.shop_name,
                "seller_slug": product.seller.slug,
                "image_url": primary_img,
                "unit_price": f"{unit_price:.2f}",
                "quantity": entry.quantity,
                "line_total": f"{line_total:.2f}",
                "available_stock": available_stock,
                "is_customizable": product.is_customizable,
                "customization_note": entry.customization_note,
                "is_available": is_available,
                "availability_issue": availability_issue,
            }
        )

    subtotal = quantize_inr(subtotal)
    discount = Decimal("0.00")
    applied_coupon_payload = None
    coupon_notice = ""

    if cart.applied_coupon_id:
        if not serialized_items:
            cart.applied_coupon = None
            cart.save(update_fields=["applied_coupon", "updated_at"])
        else:
            coupon = cart.applied_coupon
            ok, calc_discount, msg = evaluate_coupon_for_cart(
                coupon=coupon,
                user=cart.user,
                subtotal=subtotal,
            )
            if ok:
                discount = calc_discount
                applied_coupon_payload = {
                    "id": str(coupon.id),
                    "code": coupon.code,
                    "description": coupon.description,
                    "discount_type": coupon.discount_type,
                    "value": f"{coupon.value:.2f}",
                    "min_order_amount": f"{coupon.min_order_amount:.2f}",
                    "max_discount_amount": (
                        f"{coupon.max_discount_amount:.2f}"
                        if coupon.max_discount_amount is not None
                        else None
                    ),
                }
            else:
                coupon_notice = msg
                cart.applied_coupon = None
                cart.save(update_fields=["applied_coupon", "updated_at"])

    free_threshold = get_free_shipping_threshold()
    std_shipping = get_standard_shipping_fee()
    cod_max = get_cod_max_amount()

    shipping = (
        Decimal("0.00")
        if (not serialized_items or subtotal >= free_threshold)
        else std_shipping
    )
    total = quantize_inr(max(Decimal("0.00"), subtotal - discount + shipping))

    return {
        "id": str(cart.id),
        "items": serialized_items,
        "item_count": total_qty,
        "distinct_sellers_count": len(seller_ids),
        "subtotal": f"{subtotal:.2f}",
        "discount": f"{discount:.2f}",
        "shipping": f"{shipping:.2f}",
        "total": f"{total:.2f}",
        "free_shipping_threshold": f"{free_threshold:.2f}",
        "cod_max_amount": f"{cod_max:.2f}",
        "cod_eligible": total <= cod_max,
        "applied_coupon": applied_coupon_payload,
        "coupon_notice": coupon_notice,
    }
