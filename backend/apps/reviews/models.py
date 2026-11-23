"""Week 11 model: Verified-Purchase ProductReview with Seller Reply & Admin Moderation."""
from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.catalog.models import Product
from apps.orders.models import OrderItem
from apps.sellers.models import SellerProfile
from common.models import TimeStampedUUIDModel


class ProductReview(TimeStampedUUIDModel):
    """
    Verified-purchase review strictly linked 1-to-1 with a delivered OrderItem.
    Updates SellerProfile.rating_avg whenever created, hidden, or restored.
    """

    class Status(models.TextChoices):
        PUBLISHED = "PUBLISHED", "Published"
        HIDDEN = "HIDDEN", "Hidden by Admin"

    product = models.ForeignKey(
        Product,
        on_delete=models.PROTECT,
        related_name="reviews",
    )
    seller = models.ForeignKey(
        SellerProfile,
        on_delete=models.PROTECT,
        related_name="reviews",
    )
    buyer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="product_reviews",
    )
    order_item = models.OneToOneField(
        OrderItem,
        on_delete=models.PROTECT,
        related_name="review",
    )
    rating = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        db_index=True,
    )
    title = models.CharField(max_length=140, blank=True, default="")
    comment = models.TextField(max_length=1500)
    is_verified_purchase = models.BooleanField(default=True)

    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PUBLISHED,
        db_index=True,
    )
    moderation_notes = models.CharField(max_length=300, blank=True, default="")
    moderated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="moderated_reviews",
    )
    moderated_at = models.DateTimeField(null=True, blank=True)

    seller_reply = models.TextField(max_length=1000, blank=True, default="")
    seller_replied_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "product_reviews"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["product", "status", "-created_at"]),
            models.Index(fields=["seller", "status", "-created_at"]),
            models.Index(fields=["buyer", "-created_at"]),
        ]

    def __str__(self) -> str:
        return f"★{self.rating} on {self.product.title} by @{self.buyer.username}"
