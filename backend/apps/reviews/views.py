"""DRF serializers, views, and URL routes for Verified Reviews."""
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.urls import path
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Product
from apps.reviews.models import ProductReview
from apps.reviews.services import (
    compute_rating_summary,
    create_verified_review,
    moderate_admin_review,
    reply_to_seller_review,
)
from apps.sellers.models import SellerProfile
from common.permissions import IsAdminRole, IsApprovedSellerRole


class ProductReviewSerializer(serializers.ModelSerializer):
    buyer_name = serializers.SerializerMethodField()
    buyer_username = serializers.CharField(source="buyer.username", read_only=True)
    product_title = serializers.CharField(source="product.title", read_only=True)
    product_slug = serializers.CharField(source="product.slug", read_only=True)
    seller_shop_name = serializers.CharField(source="seller.shop_name", read_only=True)
    order_item_id = serializers.UUIDField(read_only=True)
    variant_label = serializers.CharField(
        source="order_item.variant_label_snapshot", read_only=True
    )

    class Meta:
        model = ProductReview
        fields = [
            "id",
            "order_item_id",
            "product_title",
            "product_slug",
            "variant_label",
            "seller_shop_name",
            "buyer_name",
            "buyer_username",
            "rating",
            "title",
            "comment",
            "is_verified_purchase",
            "status",
            "moderation_notes",
            "seller_reply",
            "seller_replied_at",
            "created_at",
        ]

    def get_buyer_name(self, obj) -> str:
        return (obj.buyer.full_name or "").strip() or obj.buyer.username


class CreateReviewSerializer(serializers.Serializer):
    order_item_id = serializers.UUIDField()
    rating = serializers.IntegerField(min_value=1, max_value=5)
    title = serializers.CharField(required=False, allow_blank=True, max_length=140, default="")
    comment = serializers.CharField(min_length=8, max_length=1500)


class SellerReplySerializer(serializers.Serializer):
    seller_reply = serializers.CharField(min_length=3, max_length=1000)


class AdminReviewModerateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[ProductReview.Status.PUBLISHED, ProductReview.Status.HIDDEN]
    )
    moderation_notes = serializers.CharField(
        required=False, allow_blank=True, max_length=300, default=""
    )


class PublicProductReviewsView(APIView):
    """GET /api/v1/products/<slug:slug>/reviews/ — Public published verified reviews."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        product = get_object_or_404(
            Product,
            slug=slug,
            approval_status=Product.ApprovalStatus.APPROVED,
            is_deleted=False,
        )
        qs = ProductReview.objects.filter(
            product=product,
            status=ProductReview.Status.PUBLISHED,
        ).select_related("buyer", "product", "seller", "order_item")

        summary = compute_rating_summary(qs)
        return Response(
            {
                "summary": summary,
                "results": ProductReviewSerializer(qs[:50], many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class BuyerReviewListCreateView(APIView):
    """GET/POST /api/v1/buyer/reviews/ — Buyer views own reviews & submits verified reviews."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = ProductReview.objects.filter(buyer=request.user).select_related(
            "buyer", "product", "seller", "order_item"
        )
        return Response(
            {
                "count": qs.count(),
                "results": ProductReviewSerializer(qs[:100], many=True).data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = CreateReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        review = create_verified_review(
            buyer=request.user,
            order_item_id=d["order_item_id"],
            rating=d["rating"],
            title=d.get("title", ""),
            comment=d["comment"],
            request=request,
        )
        return Response(
            {
                "detail": "Thank you! Your verified purchase review is now published.",
                "review": ProductReviewSerializer(review).data,
            },
            status=status.HTTP_201_CREATED,
        )


class SellerReviewListView(APIView):
    """GET /api/v1/seller/reviews/ — Approved Seller views studio reviews & rating summary."""

    permission_classes = [IsApprovedSellerRole]

    def get(self, request):
        profile = SellerProfile.objects.filter(user=request.user).first()
        if profile is None:
            return Response(
                {"detail": "Seller studio profile not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        base_qs = ProductReview.objects.filter(seller=profile).select_related(
            "buyer", "product", "seller", "order_item"
        )
        rating_filter = (request.query_params.get("rating") or "").strip()
        qs = base_qs
        if rating_filter in {"1", "2", "3", "4", "5"}:
            qs = qs.filter(rating=int(rating_filter))

        summary = compute_rating_summary(base_qs)
        unreplied_count = base_qs.filter(
            status=ProductReview.Status.PUBLISHED, seller_reply=""
        ).count()
        summary["unreplied_count"] = unreplied_count
        return Response(
            {
                "summary": summary,
                "results": ProductReviewSerializer(qs[:100], many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class SellerReviewReplyView(APIView):
    """POST /api/v1/seller/reviews/<uuid:review_id>/reply/ — Seller replies to own studio review."""

    permission_classes = [IsApprovedSellerRole]

    def post(self, request, review_id):
        profile = get_object_or_404(SellerProfile, user=request.user)
        serializer = SellerReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = reply_to_seller_review(
            seller_profile=profile,
            review_id=review_id,
            seller_reply=serializer.validated_data["seller_reply"],
            request=request,
        )
        return Response(
            {
                "detail": "Studio reply saved and buyer notified.",
                "review": ProductReviewSerializer(review).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminReviewListView(APIView):
    """GET /api/v1/admin/reviews/ — Admin views all platform reviews for moderation."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = ProductReview.objects.select_related(
            "buyer", "product", "seller", "order_item"
        ).all()
        status_filter = (request.query_params.get("status") or "").strip().upper()
        if status_filter in ProductReview.Status.values:
            qs = qs.filter(status=status_filter)
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(product__title__icontains=search)
                | Q(seller__shop_name__icontains=search)
                | Q(buyer__username__icontains=search)
                | Q(comment__icontains=search)
            )
        return Response(
            {
                "count": qs.count(),
                "summary": compute_rating_summary(ProductReview.objects.all()),
                "results": ProductReviewSerializer(qs[:100], many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminReviewModerateView(APIView):
    """POST /api/v1/admin/reviews/<uuid:review_id>/moderate/ — Hide or restore review."""

    permission_classes = [IsAdminRole]

    def post(self, request, review_id):
        serializer = AdminReviewModerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        review = moderate_admin_review(
            admin_user=request.user,
            review_id=review_id,
            new_status=serializer.validated_data["status"],
            moderation_notes=serializer.validated_data.get("moderation_notes", ""),
            request=request,
        )
        return Response(
            {
                "detail": f"Review marked as {review.get_status_display()}.",
                "review": ProductReviewSerializer(review).data,
            },
            status=status.HTTP_200_OK,
        )


reviews_urlpatterns = [
    path(
        "products/<slug:slug>/reviews/",
        PublicProductReviewsView.as_view(),
        name="public-product-reviews",
    ),
    path(
        "buyer/reviews/",
        BuyerReviewListCreateView.as_view(),
        name="buyer-reviews",
    ),
    path(
        "seller/reviews/",
        SellerReviewListView.as_view(),
        name="seller-reviews-list",
    ),
    path(
        "seller/reviews/<uuid:review_id>/reply/",
        SellerReviewReplyView.as_view(),
        name="seller-review-reply",
    ),
]

admin_reviews_urlpatterns = [
    path(
        "reviews/",
        AdminReviewListView.as_view(),
        name="admin-reviews-list",
    ),
    path(
        "reviews/<uuid:review_id>/moderate/",
        AdminReviewModerateView.as_view(),
        name="admin-review-moderate",
    ),
]
