"""Transactional domain services for Categories, Products, Cloudinary Images, and Moderation."""
import uuid
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.audit.services import record_audit_log
from apps.catalog.models import (
    Category,
    Inventory,
    InventoryTransaction,
    Product,
    ProductImage,
    ProductVariant,
)
from apps.sellers.models import SellerProfile
from common.cloudinary_utils import delete_cloudinary_asset, upload_image_to_cloudinary

MAX_PRODUCT_IMAGES = 6


def _unique_slug(model_cls, raw_text: str, *, exclude_pk=None, max_len: int = 180) -> str:
    base = slugify(raw_text)[: max_len - 12] or "craft"
    candidate = base
    counter = 1
    while True:
        qs = model_cls.objects.filter(slug=candidate)
        if exclude_pk is not None:
            qs = qs.exclude(pk=exclude_pk)
        if not qs.exists():
            return candidate
        counter += 1
        candidate = f"{base}-{counter}"


def _generate_sku(product_title: str) -> str:
    prefix = (slugify(product_title).replace("-", "")[:6] or "CRAFT").upper()
    return f"CR-{prefix}-{uuid.uuid4().hex[:6].upper()}"


def get_active_seller_profile(user) -> SellerProfile:
    """Resolve and verify an approved, non-suspended SellerProfile for a seller user."""
    profile = SellerProfile.objects.filter(user=user).first()
    if profile is None:
        raise PermissionDenied("Your account does not have an approved Seller studio yet.")
    if profile.is_suspended:
        raise PermissionDenied(
            "Your seller studio is currently suspended and cannot create or modify products."
        )
    return profile


# ---------------------------------------------------------------------------
# Admin Category Services
# ---------------------------------------------------------------------------


@transaction.atomic
def create_category(*, admin_user, validated_data: dict, cover_image=None, request=None) -> Category:
    name = validated_data["name"].strip()
    if Category.objects.filter(name__iexact=name).exists():
        raise ValidationError({"name": ["A craft category with this name already exists."]})

    uploaded = {}
    if cover_image is not None:
        uploaded = upload_image_to_cloudinary(cover_image, folder="craftify/categories")

    category = Category.objects.create(
        name=name,
        slug=_unique_slug(Category, name, max_len=140),
        parent=validated_data.get("parent"),
        description=(validated_data.get("description") or "").strip(),
        commission_rate=validated_data["commission_rate"],
        cover_image_url=uploaded.get("image_url", ""),
        cover_cloudinary_public_id=uploaded.get("cloudinary_public_id", ""),
        is_active=validated_data.get("is_active", True),
    )

    record_audit_log(
        actor=admin_user,
        action="CATEGORY_CREATED",
        target_model="Category",
        target_id=category.id,
        summary=f"Created category '{category.name}' with {category.commission_rate}% commission.",
        metadata={"commission_rate": str(category.commission_rate)},
        request=request,
    )
    return category


@transaction.atomic
def update_category(
    *, admin_user, category: Category, validated_data: dict, cover_image=None, request=None
) -> Category:
    old_rate = category.commission_rate
    old_public_id = category.cover_cloudinary_public_id

    if "name" in validated_data:
        new_name = validated_data["name"].strip()
        if Category.objects.filter(name__iexact=new_name).exclude(pk=category.pk).exists():
            raise ValidationError({"name": ["Another category already uses this name."]})
        category.name = new_name
        category.slug = _unique_slug(Category, new_name, exclude_pk=category.pk, max_len=140)

    if "parent" in validated_data:
        parent = validated_data["parent"]
        if parent is not None and parent.pk == category.pk:
            raise ValidationError({"parent": ["A category cannot be its own parent."]})
        category.parent = parent

    if "description" in validated_data:
        category.description = (validated_data["description"] or "").strip()

    if "commission_rate" in validated_data:
        category.commission_rate = validated_data["commission_rate"]

    if "is_active" in validated_data:
        category.is_active = validated_data["is_active"]

    if cover_image is not None:
        uploaded = upload_image_to_cloudinary(cover_image, folder="craftify/categories")
        category.cover_image_url = uploaded["image_url"]
        category.cover_cloudinary_public_id = uploaded["cloudinary_public_id"]

    category.save()

    if cover_image is not None and old_public_id:
        delete_cloudinary_asset(old_public_id)

    record_audit_log(
        actor=admin_user,
        action="CATEGORY_UPDATED",
        target_model="Category",
        target_id=category.id,
        summary=(
            f"Updated category '{category.name}' "
            f"(commission {old_rate}% -> {category.commission_rate}%, active={category.is_active})."
        ),
        metadata={
            "old_commission_rate": str(old_rate),
            "new_commission_rate": str(category.commission_rate),
            "is_active": category.is_active,
        },
        request=request,
    )
    return category


@transaction.atomic
def delete_category(*, admin_user, category: Category, request=None) -> None:
    if category.products.filter(is_deleted=False).exists():
        raise ValidationError(
            {
                "detail": (
                    "Cannot delete a category while active products belong to it. "
                    "Deactivate it instead."
                )
            }
        )
    if category.subcategories.exists():
        raise ValidationError(
            {"detail": "Cannot delete a parent category that still has subcategories."}
        )

    cat_id = category.id
    cat_name = category.name
    old_public_id = category.cover_cloudinary_public_id
    category.delete()

    if old_public_id:
        delete_cloudinary_asset(old_public_id)

    record_audit_log(
        actor=admin_user,
        action="CATEGORY_DELETED",
        target_model="Category",
        target_id=cat_id,
        summary=f"Deleted empty category '{cat_name}'.",
        request=request,
    )


# ---------------------------------------------------------------------------
# Seller Product, Variant, Inventory & Cloudinary Image Services
# ---------------------------------------------------------------------------


def _upsert_variants(product: Product, variants_data: list[dict]) -> None:
    """Create or update product variants with 1:1 Inventory and RESTOCK ledger entries."""
    if not variants_data:
        if not product.variants.exists():
            default_variant = ProductVariant.objects.create(
                product=product,
                sku=_generate_sku(product.title),
                label="Standard",
            )
            inv = Inventory.objects.create(variant=default_variant, quantity_available=1)
            InventoryTransaction.objects.create(
                inventory=inv,
                change_type=InventoryTransaction.ChangeType.RESTOCK,
                quantity_delta=1,
                note="Initial default stock",
            )
        return

    for idx, v_data in enumerate(variants_data):
        variant_id = v_data.get("id")
        qty = int(v_data.get("quantity_available", 1))
        if qty < 0:
            raise ValidationError({"variants": ["Stock quantity cannot be negative."]})

        sku_raw = (v_data.get("sku") or "").strip().upper()
        price_override = v_data.get("price_override")
        if price_override is not None and Decimal(str(price_override)) <= Decimal("0.00"):
            raise ValidationError({"variants": ["Variant price override must be greater than ₹0."]})

        if variant_id:
            variant = ProductVariant.objects.filter(id=variant_id, product=product).first()
            if variant is None:
                raise ValidationError({"variants": ["Variant does not belong to this product."]})
            if sku_raw and sku_raw != variant.sku:
                if ProductVariant.objects.filter(sku=sku_raw).exclude(pk=variant.pk).exists():
                    raise ValidationError({"variants": [f"SKU '{sku_raw}' is already in use."]})
                variant.sku = sku_raw
            variant.label = (v_data.get("label") or variant.label).strip() or "Standard"
            variant.size = (v_data.get("size") or "").strip()
            variant.color = (v_data.get("color") or "").strip()
            variant.material = (v_data.get("material") or "").strip()
            variant.dimensions_cm = (v_data.get("dimensions_cm") or "").strip()
            variant.weight_grams = int(v_data.get("weight_grams") or variant.weight_grams or 500)
            variant.price_override = price_override
            variant.is_active = bool(v_data.get("is_active", True))
            variant.save()

            inv, _ = Inventory.objects.get_or_create(variant=variant)
            delta = qty - inv.quantity_available
            if delta != 0:
                inv.quantity_available = qty
                inv.save(update_fields=["quantity_available", "updated_at"])
                InventoryTransaction.objects.create(
                    inventory=inv,
                    change_type=InventoryTransaction.ChangeType.RESTOCK,
                    quantity_delta=delta,
                    note="Seller inventory update",
                )
        else:
            sku = sku_raw or _generate_sku(product.title)
            if ProductVariant.objects.filter(sku=sku).exists():
                raise ValidationError({"variants": [f"SKU '{sku}' is already in use."]})
            variant = ProductVariant.objects.create(
                product=product,
                sku=sku,
                label=(v_data.get("label") or f"Option {idx + 1}").strip() or "Standard",
                size=(v_data.get("size") or "").strip(),
                color=(v_data.get("color") or "").strip(),
                material=(v_data.get("material") or "").strip(),
                dimensions_cm=(v_data.get("dimensions_cm") or "").strip(),
                weight_grams=int(v_data.get("weight_grams") or 500),
                price_override=price_override,
                is_active=True,
            )
            inv = Inventory.objects.create(variant=variant, quantity_available=qty)
            if qty > 0:
                InventoryTransaction.objects.create(
                    inventory=inv,
                    change_type=InventoryTransaction.ChangeType.RESTOCK,
                    quantity_delta=qty,
                    note="Initial seller stock",
                )


def attach_product_images(*, product: Product, image_files: list) -> list[ProductImage]:
    """Validate and upload multiple product photos to Cloudinary and link them to `product`."""
    if not image_files:
        return []

    existing_count = product.images.count()
    if existing_count + len(image_files) > MAX_PRODUCT_IMAGES:
        raise ValidationError(
            {"images": [f"A product can have at most {MAX_PRODUCT_IMAGES} images."]}
        )

    has_primary = product.images.filter(is_primary=True).exists()
    created_images = []
    for index, uploaded_file in enumerate(image_files):
        uploaded = upload_image_to_cloudinary(uploaded_file, folder="craftify/products")
        img = ProductImage.objects.create(
            product=product,
            image_url=uploaded["image_url"],
            cloudinary_public_id=uploaded["cloudinary_public_id"],
            alt_text=product.title[:200],
            sort_order=existing_count + index,
            is_primary=(not has_primary and index == 0),
        )
        created_images.append(img)
    return created_images


@transaction.atomic
def create_seller_product(
    *, user, validated_data: dict, variants_data: list[dict], image_files: list, request=None
) -> Product:
    seller_profile = get_active_seller_profile(user)
    category = validated_data["category"]
    if not category.is_active:
        raise ValidationError({"category": ["Selected craft category is currently inactive."]})

    title = validated_data["title"].strip()
    product = Product.objects.create(
        seller=seller_profile,
        category=category,
        title=title,
        slug=_unique_slug(Product, title, max_len=220),
        description=validated_data["description"].strip(),
        base_price=validated_data["base_price"],
        discount_price=validated_data.get("discount_price"),
        processing_days=validated_data.get("processing_days", 3),
        is_customizable=validated_data.get("is_customizable", False),
        is_made_to_order=validated_data.get("is_made_to_order", False),
        is_one_of_a_kind=validated_data.get("is_one_of_a_kind", False),
        approval_status=Product.ApprovalStatus.PENDING,
    )

    _upsert_variants(product, variants_data)
    if image_files:
        attach_product_images(product=product, image_files=image_files)

    record_audit_log(
        actor=user,
        action="PRODUCT_SUBMITTED",
        target_model="Product",
        target_id=product.id,
        summary=f"Seller '{seller_profile.shop_name}' submitted product '{product.title}' for Admin review.",
        metadata={"category": category.name, "base_price": str(product.base_price)},
        request=request,
    )
    return product


@transaction.atomic
def update_seller_product(
    *,
    user,
    product: Product,
    validated_data: dict,
    variants_data: list[dict] | None = None,
    image_files: list | None = None,
    request=None,
) -> Product:
    get_active_seller_profile(user)

    if "category" in validated_data and not validated_data["category"].is_active:
        raise ValidationError({"category": ["Selected craft category is currently inactive."]})

    for field in (
        "category",
        "title",
        "description",
        "base_price",
        "discount_price",
        "processing_days",
        "is_customizable",
        "is_made_to_order",
        "is_one_of_a_kind",
    ):
        if field in validated_data:
            val = validated_data[field]
            setattr(product, field, val.strip() if isinstance(val, str) else val)

    # If a previously REJECTED product is updated by the seller, return it to PENDING for re-review
    if product.approval_status == Product.ApprovalStatus.REJECTED:
        product.approval_status = Product.ApprovalStatus.PENDING
        product.review_notes = ""

    product.save()

    if variants_data is not None:
        _upsert_variants(product, variants_data)

    if image_files:
        attach_product_images(product=product, image_files=image_files)

    return product


@transaction.atomic
def soft_delete_seller_product(*, user, product: Product, request=None) -> None:
    get_active_seller_profile(user)
    product.is_deleted = True
    product.save(update_fields=["is_deleted", "updated_at"])
    record_audit_log(
        actor=user,
        action="PRODUCT_SOFT_DELETED",
        target_model="Product",
        target_id=product.id,
        summary=f"Seller soft-deleted product '{product.title}'.",
        request=request,
    )


@transaction.atomic
def remove_product_image(*, user, product: Product, image: ProductImage) -> None:
    get_active_seller_profile(user)
    was_primary = image.is_primary
    public_id = image.cloudinary_public_id
    image.delete()

    if was_primary:
        next_img = product.images.order_by("sort_order", "created_at").first()
        if next_img:
            next_img.is_primary = True
            next_img.save(update_fields=["is_primary", "updated_at"])

    if public_id:
        delete_cloudinary_asset(public_id)


# ---------------------------------------------------------------------------
# Admin Product Moderation Service
# ---------------------------------------------------------------------------


@transaction.atomic
def moderate_product(
    *, admin_user, product_id, action: str, review_notes: str = "", request=None
) -> Product:
    product = (
        Product.objects.select_for_update()
        .select_related("seller", "category")
        .filter(id=product_id, is_deleted=False)
        .first()
    )
    if product is None:
        raise ValidationError({"detail": "Product not found."})

    cleaned_notes = (review_notes or "").strip()
    now = timezone.now()

    if action == "REJECT":
        if not cleaned_notes:
            raise ValidationError(
                {"review_notes": ["Please provide a clear reason when rejecting a product."]}
            )
        product.approval_status = Product.ApprovalStatus.REJECTED
        product.reviewed_by = admin_user
        product.reviewed_at = now
        product.review_notes = cleaned_notes
        product.save(
            update_fields=[
                "approval_status",
                "reviewed_by",
                "reviewed_at",
                "review_notes",
                "updated_at",
            ]
        )
        record_audit_log(
            actor=admin_user,
            action="PRODUCT_REJECTED",
            target_model="Product",
            target_id=product.id,
            summary=f"Rejected product '{product.title}' from '{product.seller.shop_name}'.",
            metadata={"review_notes": cleaned_notes},
            request=request,
        )
        return product

    if action == "APPROVE":
        product.approval_status = Product.ApprovalStatus.APPROVED
        product.reviewed_by = admin_user
        product.reviewed_at = now
        product.review_notes = cleaned_notes or "Approved for Craftify storefront."
        product.save(
            update_fields=[
                "approval_status",
                "reviewed_by",
                "reviewed_at",
                "review_notes",
                "updated_at",
            ]
        )
        record_audit_log(
            actor=admin_user,
            action="PRODUCT_APPROVED",
            target_model="Product",
            target_id=product.id,
            summary=f"Approved product '{product.title}' ({product.category.name}) for storefront.",
            metadata={"seller_shop": product.seller.shop_name},
            request=request,
        )
        return product

    raise ValidationError({"action": ["Action must be either APPROVE or REJECT."]})
