"""API views for Public Storefront Catalog, Seller Product Management, and Admin Moderation."""
import uuid

from django.db.models import Count, Prefetch, Q
from django.http import Http404
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.catalog.models import Category, Product, ProductImage, ProductVariant
from apps.catalog.serializers import (
    AdminCategoryWriteSerializer,
    AdminProductModerationSerializer,
    CategorySerializer,
    ProductDetailSerializer,
    ProductImageSerializer,
    SellerProductWriteSerializer,
)
from apps.catalog.services import (
    attach_product_images,
    create_category,
    create_seller_product,
    delete_category,
    get_active_seller_profile,
    moderate_product,
    remove_product_image,
    soft_delete_seller_product,
    update_category,
    update_seller_product,
)
from common.permissions import IsAdminRole, IsApprovedSellerRole


def _product_base_queryset():
    return (
        Product.objects.filter(is_deleted=False)
        .select_related("seller", "category", "reviewed_by")
        .prefetch_related(
            "images",
            Prefetch("variants", queryset=ProductVariant.objects.select_related("inventory")),
        )
    )


# ---------------------------------------------------------------------------
# Public Storefront Catalog APIs (GET /api/v1/categories/, /api/v1/products/)
# ---------------------------------------------------------------------------


class PublicCategoryListView(APIView):
    """GET /api/v1/categories/ — Active craft categories with approved product counts."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = (
            Category.objects.filter(is_active=True)
            .select_related("parent")
            .annotate(
                approved_count=Count(
                    "products",
                    filter=Q(
                        products__approval_status=Product.ApprovalStatus.APPROVED,
                        products__is_deleted=False,
                        products__seller__is_suspended=False,
                    ),
                    distinct=True,
                )
            )
            .order_by("name")
        )
        return Response(
            {
                "count": qs.count(),
                "results": CategorySerializer(qs, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class PublicProductListView(APIView):
    """GET /api/v1/products/ — Live Admin-approved products for the Storefront Home Page."""

    permission_classes = [permissions.AllowAny]

    def get(self, request):
        qs = _product_base_queryset().filter(
            approval_status=Product.ApprovalStatus.APPROVED,
            seller__is_suspended=False,
            category__is_active=True,
        )

        category_param = (request.query_params.get("category") or "").strip()
        if category_param and category_param.lower() != "all":
            try:
                parsed_uuid = uuid.UUID(category_param)
                qs = qs.filter(category__id=parsed_uuid)
            except ValueError:
                qs = qs.filter(category__slug=category_param)

        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(description__icontains=search)
                | Q(category__name__icontains=search)
                | Q(seller__shop_name__icontains=search)
            )

        ordering = (request.query_params.get("ordering") or "newest").strip()
        if ordering == "price-asc":
            qs = qs.order_by("base_price", "-created_at")
        elif ordering == "price-desc":
            qs = qs.order_by("-base_price", "-created_at")
        else:
            qs = qs.order_by("-created_at")

        return Response(
            {
                "count": qs.count(),
                "results": ProductDetailSerializer(qs[:100], many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class PublicProductDetailView(APIView):
    """GET /api/v1/products/<slug>/ — Live detail view for an approved product."""

    permission_classes = [permissions.AllowAny]

    def get(self, request, slug):
        product = (
            _product_base_queryset()
            .filter(
                slug=slug,
                approval_status=Product.ApprovalStatus.APPROVED,
                seller__is_suspended=False,
                category__is_active=True,
            )
            .first()
        )
        if product is None:
            raise Http404("Product not found.")
        return Response(ProductDetailSerializer(product).data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Seller Product Management APIs (/api/v1/seller/products/*)
# ---------------------------------------------------------------------------


class SellerProductListCreateView(APIView):
    """GET/POST /api/v1/seller/products/ — Approved Seller lists or creates handmade products."""

    permission_classes = [IsApprovedSellerRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        seller_profile = request.user.seller_profile if hasattr(request.user, "seller_profile") else None
        if seller_profile is None:
            return Response({"count": 0, "results": []}, status=status.HTTP_200_OK)

        qs = _product_base_queryset().filter(seller=seller_profile)
        status_filter = (request.query_params.get("status") or "").strip().upper()
        if status_filter in {
            Product.ApprovalStatus.PENDING,
            Product.ApprovalStatus.APPROVED,
            Product.ApprovalStatus.REJECTED,
        }:
            qs = qs.filter(approval_status=status_filter)

        return Response(
            {
                "count": qs.count(),
                "approved_count": qs.filter(approval_status=Product.ApprovalStatus.APPROVED).count(),
                "results": ProductDetailSerializer(qs[:100], many=True).data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = SellerProductWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = dict(serializer.validated_data)
        variants_data = validated.pop("variants", [])
        image_files = request.FILES.getlist("images")

        product = create_seller_product(
            user=request.user,
            validated_data=validated,
            variants_data=variants_data,
            image_files=image_files,
            request=request,
        )
        fresh = _product_base_queryset().get(pk=product.pk)
        return Response(
            {
                "detail": "Product submitted and queued for Craftify Admin approval.",
                "product": ProductDetailSerializer(fresh).data,
            },
            status=status.HTTP_201_CREATED,
        )


class SellerProductDetailView(APIView):
    """GET/PATCH/DELETE /api/v1/seller/products/<uuid:pk>/ — Strict seller ownership isolation."""

    permission_classes = [IsApprovedSellerRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_owned_product(self, request, pk) -> Product:
        seller_profile = get_active_seller_profile(request.user)
        product = _product_base_queryset().filter(pk=pk, seller=seller_profile).first()
        if product is None:
            raise Http404("Product not found in your studio.")
        return product

    def get(self, request, pk):
        product = self._get_owned_product(request, pk)
        return Response(ProductDetailSerializer(product).data, status=status.HTTP_200_OK)

    def patch(self, request, pk):
        product = self._get_owned_product(request, pk)
        serializer = SellerProductWriteSerializer(
            instance=product, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        validated = dict(serializer.validated_data)
        variants_data = validated.pop("variants", None)
        image_files = request.FILES.getlist("images")

        updated = update_seller_product(
            user=request.user,
            product=product,
            validated_data=validated,
            variants_data=variants_data,
            image_files=image_files,
            request=request,
        )
        fresh = _product_base_queryset().get(pk=updated.pk)
        return Response(
            {
                "detail": "Product updated successfully.",
                "product": ProductDetailSerializer(fresh).data,
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        product = self._get_owned_product(request, pk)
        soft_delete_seller_product(user=request.user, product=product, request=request)
        return Response(
            {"detail": f"Product '{product.title}' removed from your catalog."},
            status=status.HTTP_200_OK,
        )


class SellerProductImageUploadView(APIView):
    """POST /api/v1/seller/products/<uuid:pk>/images/ — Upload additional Cloudinary photos."""

    permission_classes = [IsApprovedSellerRole]
    parser_classes = [MultiPartParser, FormParser]
    throttle_scope = "media_upload"

    def post(self, request, pk):
        seller_profile = get_active_seller_profile(request.user)
        product = _product_base_queryset().filter(pk=pk, seller=seller_profile).first()
        if product is None:
            raise Http404("Product not found in your studio.")

        files = request.FILES.getlist("images")
        if not files and "image" in request.FILES:
            files = [request.FILES["image"]]
        if not files:
            return Response(
                {"detail": "Please choose at least one JPG, PNG, or WEBP image file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = attach_product_images(product=product, image_files=files)
        return Response(
            {
                "detail": f"Uploaded {len(created)} photo(s) to Cloudinary.",
                "images": ProductImageSerializer(created, many=True).data,
            },
            status=status.HTTP_201_CREATED,
        )


class SellerProductImageDetailView(APIView):
    """PATCH (set primary) / DELETE /api/v1/seller/products/<uuid:product_id>/images/<uuid:image_id>/"""

    permission_classes = [IsApprovedSellerRole]

    def _get_owned_image(self, request, product_id, image_id):
        seller_profile = get_active_seller_profile(request.user)
        product = Product.objects.filter(
            pk=product_id, seller=seller_profile, is_deleted=False
        ).first()
        if product is None:
            raise Http404("Product not found in your studio.")
        image = ProductImage.objects.filter(pk=image_id, product=product).first()
        if image is None:
            raise Http404("Image not found.")
        return product, image

    def patch(self, request, product_id, image_id):
        product, image = self._get_owned_image(request, product_id, image_id)
        product.images.update(is_primary=False)
        image.is_primary = True
        image.save(update_fields=["is_primary", "updated_at"])
        return Response(
            {"detail": "Primary product image updated.", "image": ProductImageSerializer(image).data},
            status=status.HTTP_200_OK,
        )

    def delete(self, request, product_id, image_id):
        product, image = self._get_owned_image(request, product_id, image_id)
        remove_product_image(user=request.user, product=product, image=image)
        return Response({"detail": "Product image deleted."}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Admin Category & Product Moderation APIs (/api/v1/admin/categories/, /products/)
# ---------------------------------------------------------------------------


class AdminCategoryListCreateView(APIView):
    """GET/POST /api/v1/admin/categories/ — Admin manages craft categories & commission rates."""

    permission_classes = [IsAdminRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        qs = (
            Category.objects.select_related("parent")
            .annotate(
                approved_count=Count(
                    "products",
                    filter=Q(
                        products__approval_status=Product.ApprovalStatus.APPROVED,
                        products__is_deleted=False,
                    ),
                    distinct=True,
                )
            )
            .order_by("name")
        )
        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(description__icontains=search))
        return Response(
            {
                "count": qs.count(),
                "results": CategorySerializer(qs, many=True).data,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        serializer = AdminCategoryWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated = dict(serializer.validated_data)
        cover_image = validated.pop("cover_image", None)
        category = create_category(
            admin_user=request.user,
            validated_data=validated,
            cover_image=cover_image,
            request=request,
        )
        return Response(
            {
                "detail": f"Category '{category.name}' created with {category.commission_rate}% commission.",
                "category": CategorySerializer(category).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminCategoryDetailView(APIView):
    """PATCH/DELETE /api/v1/admin/categories/<uuid:pk>/"""

    permission_classes = [IsAdminRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _get_category(self, pk) -> Category:
        cat = Category.objects.filter(pk=pk).first()
        if cat is None:
            raise Http404("Category not found.")
        return cat

    def patch(self, request, pk):
        category = self._get_category(pk)
        serializer = AdminCategoryWriteSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        validated = dict(serializer.validated_data)
        cover_image = validated.pop("cover_image", None)
        updated = update_category(
            admin_user=request.user,
            category=category,
            validated_data=validated,
            cover_image=cover_image,
            request=request,
        )
        return Response(
            {
                "detail": f"Category '{updated.name}' updated.",
                "category": CategorySerializer(updated).data,
            },
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        category = self._get_category(pk)
        delete_category(admin_user=request.user, category=category, request=request)
        return Response({"detail": "Category deleted."}, status=status.HTTP_200_OK)


class AdminProductListView(APIView):
    """GET /api/v1/admin/products/?status=PENDING&search=..."""

    permission_classes = [IsAdminRole]

    def get(self, request):
        qs = _product_base_queryset()
        status_filter = (request.query_params.get("status") or "").strip().upper()
        if status_filter in {
            Product.ApprovalStatus.PENDING,
            Product.ApprovalStatus.APPROVED,
            Product.ApprovalStatus.REJECTED,
        }:
            qs = qs.filter(approval_status=status_filter)

        search = (request.query_params.get("search") or "").strip()
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(seller__shop_name__icontains=search)
                | Q(category__name__icontains=search)
            )

        return Response(
            {
                "count": qs.count(),
                "results": ProductDetailSerializer(qs[:100], many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminProductModerateView(APIView):
    """POST /api/v1/admin/products/<uuid:pk>/moderate/"""

    permission_classes = [IsAdminRole]

    def post(self, request, pk):
        serializer = AdminProductModerationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        product = moderate_product(
            admin_user=request.user,
            product_id=pk,
            action=serializer.validated_data["action"],
            review_notes=serializer.validated_data.get("review_notes", ""),
            request=request,
        )
        fresh = _product_base_queryset().get(pk=product.pk)
        return Response(
            {
                "detail": (
                    f"Product '{fresh.title}' approved and published to the Storefront."
                    if fresh.approval_status == Product.ApprovalStatus.APPROVED
                    else f"Product '{fresh.title}' rejected with review notes."
                ),
                "product": ProductDetailSerializer(fresh).data,
            },
            status=status.HTTP_200_OK,
        )
