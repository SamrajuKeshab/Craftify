"""Transactional services for Verified Purchase Reviews, Seller Replies & Admin Moderation."""
from decimal import Decimal

from django.db import transaction
from django.db.models import Avg, Count
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.audit.services import record_audit_log
from apps.notifications.models import Notification
from apps.notifications.services import create_notification
from apps.orders.models import OrderItem, SellerSuborder
from apps.reviews.models import ProductReview
from apps.sellers.models import SellerProfile


def compute_rating_summary(reviews_qs) -> dict:
    """Compute average rating, total count, and 5-to-1 star distribution for a queryset."""
    published = reviews_qs.filter(status=ProductReview.Status.PUBLISHED)
    agg = published.aggregate(avg=Avg("rating"), count=Count("id"))
    avg_val = agg["avg"]
    avg_decimal = (
        Decimal(str(round(float(avg_val), 2))) if avg_val is not None else Decimal("0.00")
    )
    raw_dist = {
        row["rating"]: row["total"]
        for row in published.values("rating").annotate(total=Count("id"))
    }
    distribution = [
        {"stars": s, "count": int(raw_dist.get(s, 0))}
        for s in (5, 4, 3, 2, 1)
    ]
    return {
        "rating_avg": f"{avg_decimal:.2f}",
        "review_count": int(agg["count"] or 0),
        "distribution": distribution,
    }


def _recalculate_seller_rating(seller_id) -> Decimal:
    """Persist live rating_avg on SellerProfile from all PUBLISHED studio reviews."""
    agg = ProductReview.objects.filter(
        seller_id=seller_id,
        status=ProductReview.Status.PUBLISHED,
    ).aggregate(avg=Avg("rating"))
    avg_val = agg["avg"]
    rating_avg = (
        Decimal(str(round(float(avg_val), 2))) if avg_val is not None else Decimal("0.00")
    )
    SellerProfile.objects.filter(pk=seller_id).update(rating_avg=rating_avg)
    return rating_avg


@transaction.atomic
def create_verified_review(
    *,
    buyer,
    order_item_id,
    rating: int,
    title: str = "",
    comment: str = "",
    request=None,
) -> ProductReview:
    """
    Create a Verified Purchase review strictly for a DELIVERED OrderItem owned by `buyer`.
    Prevents unverified submissions and duplicate reviews per OrderItem.
    """
    order_item = (
        OrderItem.objects.select_for_update(of=("self",))
        .select_related("suborder", "suborder__parent_order", "suborder__seller")
        .filter(pk=order_item_id, suborder__parent_order__buyer=buyer)
        .first()
    )
    if order_item is None:
        raise ValidationError("Order item not found for your account.")

    if order_item.suborder.fulfilment_status != SellerSuborder.FulfilmentStatus.DELIVERED:
        raise ValidationError(
            "You can submit a verified review only after this craft order is delivered."
        )

    if order_item.product_id is None:
        raise ValidationError("This craft listing is no longer available for review.")

    if ProductReview.objects.filter(order_item=order_item).exists():
        raise ValidationError("You have already reviewed this purchased item.")

    clean_comment = (comment or "").strip()
    if len(clean_comment) < 8:
        raise ValidationError(
            {"comment": ["Please share at least 8 characters about the craft quality."]}
        )

    review = ProductReview.objects.create(
        product_id=order_item.product_id,
        seller=order_item.suborder.seller,
        buyer=buyer,
        order_item=order_item,
        rating=int(rating),
        title=(title or "").strip()[:140],
        comment=clean_comment[:1500],
        is_verified_purchase=True,
        status=ProductReview.Status.PUBLISHED,
    )

    _recalculate_seller_rating(order_item.suborder.seller_id)

    create_notification(
        recipient=order_item.suborder.seller.user,
        category=Notification.Category.REVIEW,
        title=f"New ★{review.rating} verified review",
        message=(
            f"@{buyer.username} rated '{order_item.product_title_snapshot}' "
            f"★{review.rating}/5."
        ),
        action_url="/seller",
        metadata={
            "review_id": str(review.id),
            "rating": review.rating,
            "product_title": order_item.product_title_snapshot,
        },
    )

    record_audit_log(
        actor=buyer,
        action="VERIFIED_REVIEW_CREATED",
        target_model="ProductReview",
        target_id=review.id,
        summary=(
            f"@{buyer.username} posted ★{review.rating} verified review for "
            f"{order_item.product_title_snapshot}"
        ),
        metadata={
            "rating": review.rating,
            "order_item_id": str(order_item.id),
            "seller_shop": order_item.suborder.seller.shop_name,
        },
        request=request,
    )

    return ProductReview.objects.select_related(
        "product", "seller", "buyer", "order_item"
    ).get(pk=review.pk)


@transaction.atomic
def reply_to_seller_review(
    *,
    seller_profile: SellerProfile,
    review_id,
    seller_reply: str,
    request=None,
) -> ProductReview:
    """Allow an approved Seller to post or update a studio response on their own review."""
    review = (
        ProductReview.objects.select_for_update(of=("self",))
        .select_related("buyer", "product", "seller")
        .filter(pk=review_id, seller=seller_profile)
        .first()
    )
    if review is None:
        raise ValidationError("Review not found for your artisan studio.")

    clean_reply = (seller_reply or "").strip()
    if len(clean_reply) < 3:
        raise ValidationError(
            {"seller_reply": ["Enter a reply of at least 3 characters."]}
        )

    review.seller_reply = clean_reply[:1000]
    review.seller_replied_at = timezone.now()
    review.save(update_fields=["seller_reply", "seller_replied_at", "updated_at"])

    create_notification(
        recipient=review.buyer,
        category=Notification.Category.REVIEW,
        title=f"{seller_profile.shop_name} replied to your review",
        message=f"Studio response on '{review.product.title}': {clean_reply[:160]}",
        action_url=f"/products/{review.product.slug}",
        metadata={
            "review_id": str(review.id),
            "product_slug": review.product.slug,
        },
    )

    record_audit_log(
        actor=seller_profile.user,
        action="SELLER_REPLIED_REVIEW",
        target_model="ProductReview",
        target_id=review.id,
        summary=f"{seller_profile.shop_name} replied to review on '{review.product.title}'",
        metadata={"review_id": str(review.id)},
        request=request,
    )

    return ProductReview.objects.select_related(
        "product", "seller", "buyer", "order_item"
    ).get(pk=review.pk)


@transaction.atomic
def moderate_admin_review(
    *,
    admin_user,
    review_id,
    new_status: str,
    moderation_notes: str = "",
    request=None,
) -> ProductReview:
    """Admin hides or restores a product review and recalculates studio rating."""
    review = (
        ProductReview.objects.select_for_update(of=("self",))
        .select_related("buyer", "product", "seller")
        .filter(pk=review_id)
        .first()
    )
    if review is None:
        raise ValidationError("Product review not found.")

    if new_status not in (
        ProductReview.Status.PUBLISHED,
        ProductReview.Status.HIDDEN,
    ):
        raise ValidationError({"status": ["Choose PUBLISHED or HIDDEN."]})

    clean_notes = (moderation_notes or "").strip()[:300]
    if new_status == ProductReview.Status.HIDDEN and len(clean_notes) < 5:
        raise ValidationError(
            {"moderation_notes": ["Provide a reason (min 5 chars) when hiding a review."]}
        )

    review.status = new_status
    review.moderation_notes = clean_notes
    review.moderated_by = admin_user
    review.moderated_at = timezone.now()
    review.save(
        update_fields=[
            "status",
            "moderation_notes",
            "moderated_by",
            "moderated_at",
            "updated_at",
        ]
    )

    _recalculate_seller_rating(review.seller_id)

    record_audit_log(
        actor=admin_user,
        action=f"ADMIN_REVIEW_{new_status}",
        target_model="ProductReview",
        target_id=review.id,
        summary=(
            f"Admin marked review on '{review.product.title}' as {new_status}"
            + (f" ({clean_notes})" if clean_notes else "")
        ),
        metadata={"new_status": new_status, "moderation_notes": clean_notes},
        request=request,
    )

    return ProductReview.objects.select_related(
        "product", "seller", "buyer", "order_item", "moderated_by"
    ).get(pk=review.pk)
