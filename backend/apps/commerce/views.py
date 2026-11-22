"""Week 7 API views: Buyer Addresses, Persistent Cart, Wishlist, and Admin Coupons."""
from decimal import Decimal

from django.db import transaction
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.services import record_audit_log
from apps.catalog.models import Product, ProductVariant
from apps.commerce.models import BuyerAddress, CartItem, Coupon, WishlistItem
from apps.commerce.serializers import (
    AdminCouponReadSerializer,
    AdminCouponWriteSerializer,
    BuyerAddressSerializer,
    CartAddItemSerializer,
    CartUpdateItemSerializer,
    CouponCodeInputSerializer,
    WishlistItemSerializer,
    WishlistMoveToCartSerializer,
    WishlistToggleSerializer,
)
from apps.commerce.services import (
    build_cart_payload,
    evaluate_coupon_for_cart,
    evaluate_variant_availability,
    get_or_create_user_cart,
    get_or_create_user_wishlist,
)
from common.permissions import IsAdminRole


# ---------------------------------------------------------------------------
# 1. Buyer Delivery Address Book (/api/v1/buyer/addresses/*)
# ---------------------------------------------------------------------------


class BuyerAddressListCreateView(APIView):
    """List or create persistent Indian delivery addresses owned by the signed-in user."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        addresses = BuyerAddress.objects.filter(user=request.user).order_by(
            "-is_default", "-updated_at"
        )
        serializer = BuyerAddressSerializer(addresses, many=True)
        return Response({"count": len(serializer.data), "results": serializer.data})

    @transaction.atomic
    def post(self, request):
        serializer = BuyerAddressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        existing_qs = BuyerAddress.objects.filter(user=request.user)
        should_be_default = bool(serializer.validated_data.get("is_default", False))
        if not existing_qs.exists():
            should_be_default = True

        if should_be_default:
            existing_qs.update(is_default=False)

        address = serializer.save(user=request.user, is_default=should_be_default)
        return Response(
            {
                "detail": "Delivery address saved.",
                "address": BuyerAddressSerializer(address).data,
            },
            status=status.HTTP_201_CREATED,
        )


class BuyerAddressDetailView(APIView):
    """Update or delete an individual BuyerAddress owned strictly by request.user."""

    permission_classes = [permissions.IsAuthenticated]

    def _get_owned_address(self, user, address_id):
        return get_object_or_404(BuyerAddress, pk=address_id, user=user)

    @transaction.atomic
    def patch(self, request, address_id):
        address = self._get_owned_address(request.user, address_id)
        serializer = BuyerAddressSerializer(address, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        set_default = serializer.validated_data.get("is_default")
        if set_default is True:
            BuyerAddress.objects.filter(user=request.user).exclude(pk=address.pk).update(
                is_default=False
            )

        updated = serializer.save()

        # Ensure at least one address remains default if the user only has one
        if not BuyerAddress.objects.filter(user=request.user, is_default=True).exists():
            updated.is_default = True
            updated.save(update_fields=["is_default", "updated_at"])

        return Response(
            {
                "detail": "Delivery address updated.",
                "address": BuyerAddressSerializer(updated).data,
            }
        )

    @transaction.atomic
    def delete(self, request, address_id):
        address = self._get_owned_address(request.user, address_id)
        was_default = address.is_default
        address.delete()

        if was_default:
            next_addr = (
                BuyerAddress.objects.filter(user=request.user)
                .order_by("-updated_at")
                .first()
            )
            if next_addr:
                next_addr.is_default = True
                next_addr.save(update_fields=["is_default", "updated_at"])

        return Response({"detail": "Delivery address removed."})


class BuyerAddressSetDefaultView(APIView):
    """Atomically set one of the user's saved addresses as their default delivery address."""

    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, address_id):
        address = get_object_or_404(BuyerAddress, pk=address_id, user=request.user)
        BuyerAddress.objects.filter(user=request.user).update(is_default=False)
        address.is_default = True
        address.save(update_fields=["is_default", "updated_at"])
        return Response(
            {
                "detail": "Default delivery address updated.",
                "address": BuyerAddressSerializer(address).data,
            }
        )


# ---------------------------------------------------------------------------
# 2. Persistent Shopping Cart & Coupon Application (/api/v1/cart/*)
# ---------------------------------------------------------------------------


def _resolve_purchasable_variant(*, variant_id=None, product_id=None) -> ProductVariant:
    """Resolve an active variant from variant_id or fall back to product's first active variant."""
    base_qs = ProductVariant.objects.select_related(
        "inventory",
        "product",
        "product__category",
        "product__seller",
    )
    if variant_id:
        return get_object_or_404(base_qs, pk=variant_id)

    product = get_object_or_404(
        Product.objects.select_related("category", "seller"),
        pk=product_id,
        is_deleted=False,
        approval_status=Product.ApprovalStatus.APPROVED,
    )
    variants = list(
        base_qs.filter(product=product, is_active=True).order_by("created_at")
    )
    if not variants:
        return None
    # Prefer the first active variant that has stock available
    for variant in variants:
        inv = getattr(variant, "inventory", None)
        if inv and inv.quantity_available > 0:
            return variant
    return variants[0]


class CartView(APIView):
    """Fetch or clear the authenticated user's persistent PostgreSQL cart."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        cart = get_or_create_user_cart(request.user)
        return Response(build_cart_payload(cart))

    @transaction.atomic
    def delete(self, request):
        cart = get_or_create_user_cart(request.user)
        cart.items.all().delete()
        if cart.applied_coupon_id:
            cart.applied_coupon = None
            cart.save(update_fields=["applied_coupon", "updated_at"])
        return Response(build_cart_payload(cart))


class CartItemAddView(APIView):
    """Add a product variant (plus optional customization note) to the user's persistent cart."""

    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = CartAddItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        variant = _resolve_purchasable_variant(
            variant_id=serializer.validated_data.get("variant_id"),
            product_id=serializer.validated_data.get("product_id"),
        )
        if variant is None:
            return Response(
                {"detail": "No purchasable variant is available for this craft."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart = get_or_create_user_cart(request.user)
        add_qty = serializer.validated_data["quantity"]
        note = serializer.validated_data["customization_note"]

        existing = CartItem.objects.filter(cart=cart, variant=variant).first()
        target_qty = (existing.quantity if existing else 0) + add_qty

        is_ok, reason, _ = evaluate_variant_availability(variant, target_qty)
        if not is_ok:
            return Response({"detail": reason}, status=status.HTTP_400_BAD_REQUEST)

        if existing:
            existing.quantity = target_qty
            if note and variant.product.is_customizable:
                existing.customization_note = note
            existing.save(update_fields=["quantity", "customization_note", "updated_at"])
        else:
            CartItem.objects.create(
                cart=cart,
                variant=variant,
                quantity=target_qty,
                customization_note=note if variant.product.is_customizable else "",
            )

        return Response(
            {
                "detail": f'Added "{variant.product.title}" to your cart.',
                "cart": build_cart_payload(cart),
            },
            status=status.HTTP_201_CREATED,
        )


class CartItemDetailView(APIView):
    """Update quantity/customization note or remove a single cart line item."""

    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def patch(self, request, item_id):
        cart = get_or_create_user_cart(request.user)
        item = get_object_or_404(
            CartItem.objects.select_related(
                "variant",
                "variant__inventory",
                "variant__product",
                "variant__product__category",
                "variant__product__seller",
            ),
            pk=item_id,
            cart=cart,
        )

        serializer = CartUpdateItemSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        if "quantity" in serializer.validated_data:
            new_qty = serializer.validated_data["quantity"]
            if new_qty == 0:
                item.delete()
                return Response(
                    {
                        "detail": "Item removed from cart.",
                        "cart": build_cart_payload(cart),
                    }
                )
            is_ok, reason, _ = evaluate_variant_availability(item.variant, new_qty)
            if not is_ok:
                return Response({"detail": reason}, status=status.HTTP_400_BAD_REQUEST)
            item.quantity = new_qty

        if "customization_note" in serializer.validated_data:
            if item.variant.product.is_customizable:
                item.customization_note = serializer.validated_data["customization_note"]
            else:
                item.customization_note = ""

        item.save(update_fields=["quantity", "customization_note", "updated_at"])
        return Response(
            {
                "detail": "Cart updated.",
                "cart": build_cart_payload(cart),
            }
        )

    @transaction.atomic
    def delete(self, request, item_id):
        cart = get_or_create_user_cart(request.user)
        item = get_object_or_404(CartItem, pk=item_id, cart=cart)
        item.delete()
        return Response(
            {
                "detail": "Item removed from cart.",
                "cart": build_cart_payload(cart),
            }
        )


class CartApplyCouponView(APIView):
    """Validate and attach a platform coupon to the user's persistent cart."""

    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = CouponCodeInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data["code"]

        coupon = Coupon.objects.filter(code__iexact=code).first()
        if not coupon:
            return Response(
                {"detail": f"Coupon code '{code}' was not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart = get_or_create_user_cart(request.user)
        current_payload = build_cart_payload(cart)
        subtotal = Decimal(current_payload["subtotal"])

        ok, discount, msg = evaluate_coupon_for_cart(
            coupon=coupon,
            user=request.user,
            subtotal=subtotal,
        )
        if not ok:
            return Response({"detail": msg}, status=status.HTTP_400_BAD_REQUEST)

        cart.applied_coupon = coupon
        cart.save(update_fields=["applied_coupon", "updated_at"])

        return Response(
            {
                "detail": msg,
                "discount": f"{discount:.2f}",
                "cart": build_cart_payload(cart),
            }
        )


class CartRemoveCouponView(APIView):
    """Detach any applied coupon from the user's cart."""

    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def delete(self, request):
        cart = get_or_create_user_cart(request.user)
        if cart.applied_coupon_id:
            cart.applied_coupon = None
            cart.save(update_fields=["applied_coupon", "updated_at"])
        return Response(
            {
                "detail": "Coupon removed.",
                "cart": build_cart_payload(cart),
            }
        )


class CouponValidateView(APIView):
    """Read-only server validation of a coupon code against the user's active cart."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CouponCodeInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        code = serializer.validated_data["code"]

        coupon = Coupon.objects.filter(code__iexact=code).first()
        if not coupon:
            return Response(
                {"valid": False, "detail": f"Coupon code '{code}' was not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart = get_or_create_user_cart(request.user)
        current_payload = build_cart_payload(cart)
        subtotal = Decimal(current_payload["subtotal"])

        ok, discount, msg = evaluate_coupon_for_cart(
            coupon=coupon,
            user=request.user,
            subtotal=subtotal,
        )
        if not ok:
            return Response(
                {"valid": False, "detail": msg},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "valid": True,
                "code": coupon.code,
                "description": coupon.description,
                "discount_type": coupon.discount_type,
                "value": f"{coupon.value:.2f}",
                "discount": f"{discount:.2f}",
                "detail": msg,
            }
        )


# ---------------------------------------------------------------------------
# 3. Persistent Wishlist (/api/v1/wishlist/*)
# ---------------------------------------------------------------------------


def _build_wishlist_payload(user) -> dict:
    wishlist = get_or_create_user_wishlist(user)
    items = list(
        wishlist.items.filter(
            product__approval_status=Product.ApprovalStatus.APPROVED,
            product__is_deleted=False,
            product__category__is_active=True,
            product__seller__is_suspended=False,
        )
        .select_related("product", "product__category", "product__seller")
        .prefetch_related(
            "product__images",
            Prefetch(
                "product__variants",
                queryset=ProductVariant.objects.select_related("inventory").order_by(
                    "created_at"
                ),
            ),
        )
        .order_by("-created_at")
    )
    serialized = WishlistItemSerializer(items, many=True).data
    product_ids = [str(entry.product_id) for entry in items]
    return {
        "count": len(serialized),
        "product_ids": product_ids,
        "items": serialized,
    }


class WishlistView(APIView):
    """Fetch authenticated user's persistent wishlist or add a craft by product_id."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(_build_wishlist_payload(request.user))

    @transaction.atomic
    def post(self, request):
        serializer = WishlistToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = get_object_or_404(
            Product,
            pk=serializer.validated_data["product_id"],
            approval_status=Product.ApprovalStatus.APPROVED,
            is_deleted=False,
            category__is_active=True,
            seller__is_suspended=False,
        )
        wishlist = get_or_create_user_wishlist(request.user)
        WishlistItem.objects.get_or_create(wishlist=wishlist, product=product)
        payload = _build_wishlist_payload(request.user)
        payload["detail"] = f'Saved "{product.title}" to wishlist.'
        return Response(payload, status=status.HTTP_201_CREATED)


class WishlistToggleView(APIView):
    """Toggle a craft in or out of the signed-in user's PostgreSQL wishlist."""

    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        serializer = WishlistToggleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product_id = serializer.validated_data["product_id"]

        wishlist = get_or_create_user_wishlist(request.user)
        existing = WishlistItem.objects.filter(
            wishlist=wishlist, product_id=product_id
        ).select_related("product").first()

        if existing:
            title = existing.product.title
            existing.delete()
            payload = _build_wishlist_payload(request.user)
            payload["action"] = "removed"
            payload["detail"] = f'Removed "{title}" from wishlist.'
            return Response(payload)

        product = get_object_or_404(
            Product,
            pk=product_id,
            approval_status=Product.ApprovalStatus.APPROVED,
            is_deleted=False,
            category__is_active=True,
            seller__is_suspended=False,
        )
        WishlistItem.objects.create(wishlist=wishlist, product=product)
        payload = _build_wishlist_payload(request.user)
        payload["action"] = "added"
        payload["detail"] = f'Saved "{product.title}" to wishlist.'
        return Response(payload, status=status.HTTP_201_CREATED)


class WishlistItemDeleteView(APIView):
    """Remove a product from the authenticated user's wishlist."""

    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def delete(self, request, product_id):
        wishlist = get_or_create_user_wishlist(request.user)
        WishlistItem.objects.filter(wishlist=wishlist, product_id=product_id).delete()
        payload = _build_wishlist_payload(request.user)
        payload["detail"] = "Removed from wishlist."
        return Response(payload)


class WishlistMoveToCartView(APIView):
    """Atomically add a wishlisted craft to cart and remove it from wishlist."""

    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request, product_id):
        serializer = WishlistMoveToCartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        variant = _resolve_purchasable_variant(
            variant_id=serializer.validated_data.get("variant_id"),
            product_id=product_id,
        )
        if variant is None:
            return Response(
                {"detail": "No purchasable variant is available for this craft."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cart = get_or_create_user_cart(request.user)
        add_qty = serializer.validated_data["quantity"]
        existing = CartItem.objects.filter(cart=cart, variant=variant).first()
        target_qty = (existing.quantity if existing else 0) + add_qty

        is_ok, reason, _ = evaluate_variant_availability(variant, target_qty)
        if not is_ok:
            return Response({"detail": reason}, status=status.HTTP_400_BAD_REQUEST)

        if existing:
            existing.quantity = target_qty
            existing.save(update_fields=["quantity", "updated_at"])
        else:
            CartItem.objects.create(
                cart=cart,
                variant=variant,
                quantity=target_qty,
                customization_note=(
                    serializer.validated_data["customization_note"].strip()
                    if variant.product.is_customizable
                    else ""
                ),
            )

        wishlist = get_or_create_user_wishlist(request.user)
        WishlistItem.objects.filter(wishlist=wishlist, product_id=product_id).delete()

        return Response(
            {
                "detail": f'Moved "{variant.product.title}" to your cart.',
                "cart": build_cart_payload(cart),
                "wishlist": _build_wishlist_payload(request.user),
            }
        )


# ---------------------------------------------------------------------------
# 4. Admin Platform Coupons CRUD (/api/v1/admin/coupons/*)
# ---------------------------------------------------------------------------


class AdminCouponListCreateView(APIView):
    """Admin-only listing and creation of Craftify platform discount coupons."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        status_filter = (request.query_params.get("status") or "").strip().upper()
        search = (request.query_params.get("search") or "").strip()
        now = timezone.now()

        qs = Coupon.objects.select_related("created_by").order_by("-created_at")

        if search:
            qs = qs.filter(Q(code__icontains=search) | Q(description__icontains=search))

        if status_filter == "ACTIVE":
            qs = qs.filter(is_active=True, valid_from__lte=now, valid_until__gte=now)
        elif status_filter == "INACTIVE":
            qs = qs.filter(is_active=False)
        elif status_filter == "EXPIRED":
            qs = qs.filter(valid_until__lt=now)
        elif status_filter == "SCHEDULED":
            qs = qs.filter(is_active=True, valid_from__gt=now)

        data = AdminCouponReadSerializer(qs, many=True).data
        return Response({"count": len(data), "results": data})

    @transaction.atomic
    def post(self, request):
        serializer = AdminCouponWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        coupon = Coupon.objects.create(
            code=d["code"],
            description=d.get("description", "").strip(),
            scope=Coupon.Scope.PLATFORM,
            discount_type=d["discount_type"],
            value=d["value"],
            min_order_amount=d.get("min_order_amount", Decimal("0.00")),
            max_discount_amount=d.get("max_discount_amount"),
            valid_from=d["valid_from"],
            valid_until=d["valid_until"],
            max_uses=d.get("max_uses", 0),
            per_user_limit=d.get("per_user_limit", 1),
            is_active=d.get("is_active", True),
            created_by=request.user,
        )

        record_audit_log(
            actor=request.user,
            action="COUPON_CREATED",
            target_model="Coupon",
            target_id=coupon.id,
            summary=(
                f"Created platform coupon {coupon.code} "
                f"({coupon.discount_type} {coupon.value})"
            ),
            metadata={
                "code": coupon.code,
                "discount_type": coupon.discount_type,
                "value": str(coupon.value),
                "min_order_amount": str(coupon.min_order_amount),
            },
            request=request,
        )

        return Response(
            {
                "detail": f"Coupon {coupon.code} created.",
                "coupon": AdminCouponReadSerializer(coupon).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminCouponDetailView(APIView):
    """Admin-only update, toggle, or deletion of a platform coupon."""

    permission_classes = [IsAdminRole]

    @transaction.atomic
    def patch(self, request, coupon_id):
        coupon = get_object_or_404(Coupon, pk=coupon_id)
        serializer = AdminCouponWriteSerializer(
            instance=coupon, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        for field in (
            "code",
            "description",
            "discount_type",
            "value",
            "min_order_amount",
            "max_discount_amount",
            "valid_from",
            "valid_until",
            "max_uses",
            "per_user_limit",
            "is_active",
        ):
            if field in d:
                setattr(coupon, field, d[field])

        coupon.save()

        record_audit_log(
            actor=request.user,
            action="COUPON_UPDATED",
            target_model="Coupon",
            target_id=coupon.id,
            summary=(
                f"Updated platform coupon {coupon.code} "
                f"({'Active' if coupon.is_active else 'Inactive'})"
            ),
            metadata={
                "code": coupon.code,
                "is_active": coupon.is_active,
                "value": str(coupon.value),
            },
            request=request,
        )

        return Response(
            {
                "detail": f"Coupon {coupon.code} updated.",
                "coupon": AdminCouponReadSerializer(coupon).data,
            }
        )

    @transaction.atomic
    def delete(self, request, coupon_id):
        coupon = get_object_or_404(Coupon, pk=coupon_id)
        if coupon.used_count > 0 or coupon.usages.exists():
            return Response(
                {
                    "detail": (
                        f"Coupon {coupon.code} has already been redeemed and cannot be "
                        "deleted. Deactivate it instead to preserve order records."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        code = coupon.code
        cid = coupon.id
        coupon.delete()

        record_audit_log(
            actor=request.user,
            action="COUPON_DELETED",
            target_model="Coupon",
            target_id=cid,
            summary=f"Deleted unused platform coupon {code}",
            metadata={"code": code},
            request=request,
        )

        return Response({"detail": f"Coupon {code} deleted."})
