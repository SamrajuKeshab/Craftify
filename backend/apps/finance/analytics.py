"""Week 11 Real PostgreSQL Analytics Aggregations for Admin & Seller Dashboards."""
from datetime import datetime
from decimal import Decimal

from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from apps.commerce.services import quantize_inr
from apps.finance.models import LedgerEntry, RefundRecord, SellerPayout
from apps.orders.models import Order, OrderItem, SellerSuborder
from apps.reviews.models import ProductReview
from apps.sellers.models import SellerProfile


def _last_six_month_buckets():
    """Return list of (year, month, label) tuples for the trailing 6 calendar months."""
    now = timezone.localtime(timezone.now())
    y, m = now.year, now.month
    buckets = []
    for _ in range(6):
        label = datetime(y, m, 1).strftime("%b")
        buckets.append((y, m, label))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    buckets.reverse()
    return buckets


def compute_admin_platform_analytics() -> dict:
    """
    Live PostgreSQL analytics for Craftify Admin Reports & Analytics:
    - 6-month GMV vs. Net Commission trend
    - Top craft categories by revenue & commission
    - Suborder fulfilment funnel
    - Razorpay vs. COD payment mix
    - Top 5 artisan studios with live rating_avg & review_count
    - Marketplace quality metrics (avg rating, published reviews, return rate)
    """
    valid_orders = Order.objects.exclude(
        overall_status__in=[
            Order.OverallStatus.PENDING_PAYMENT,
            Order.OverallStatus.PAYMENT_FAILED,
            Order.OverallStatus.CANCELLED,
        ]
    )
    valid_suborders = SellerSuborder.objects.exclude(
        fulfilment_status__in=[
            SellerSuborder.FulfilmentStatus.PENDING_PAYMENT,
            SellerSuborder.FulfilmentStatus.CANCELLED,
        ]
    )

    # 1. Trailing 6-month Revenue & Commission series
    buckets = _last_six_month_buckets()
    monthly_performance = []
    for year, month, label in buckets:
        month_orders = valid_orders.filter(
            created_at__year=year, created_at__month=month
        )
        rev = month_orders.aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")
        order_cnt = month_orders.count()
        comm = (
            valid_suborders.filter(
                created_at__year=year, created_at__month=month
            ).aggregate(total=Sum("commission_amount"))["total"]
            or Decimal("0.00")
        )
        monthly_performance.append(
            {
                "month": label,
                "revenue": float(quantize_inr(rev)),
                "commission": float(quantize_inr(comm)),
                "orders": order_cnt,
            }
        )

    # 2. Category revenue & commission breakdown
    cat_rows = (
        OrderItem.objects.filter(
            suborder__in=valid_suborders,
            product__category__isnull=False,
        )
        .values("product__category__name")
        .annotate(
            revenue=Sum("line_total"),
            units_sold=Sum("quantity"),
            order_count=Count("suborder__parent_order_id", distinct=True),
        )
        .order_by("-revenue")[:8]
    )
    category_breakdown = [
        {
            "category": row["product__category__name"],
            "revenue": float(quantize_inr(row["revenue"] or Decimal("0.00"))),
            "units_sold": int(row["units_sold"] or 0),
            "orders": int(row["order_count"] or 0),
        }
        for row in cat_rows
    ]

    # 3. Suborder fulfilment funnel
    funnel_counts = {
        row["fulfilment_status"]: row["total"]
        for row in SellerSuborder.objects.exclude(
            fulfilment_status=SellerSuborder.FulfilmentStatus.PENDING_PAYMENT
        )
        .values("fulfilment_status")
        .annotate(total=Count("id"))
    }
    fulfilment_funnel = [
        {"status": st, "count": int(funnel_counts.get(st, 0))}
        for st in (
            SellerSuborder.FulfilmentStatus.PENDING,
            SellerSuborder.FulfilmentStatus.ACCEPTED,
            SellerSuborder.FulfilmentStatus.PACKED,
            SellerSuborder.FulfilmentStatus.SHIPPED,
            SellerSuborder.FulfilmentStatus.DELIVERED,
            SellerSuborder.FulfilmentStatus.RETURNED,
            SellerSuborder.FulfilmentStatus.CANCELLED,
        )
    ]

    # 4. Payment mix (Razorpay vs COD)
    payment_rows = (
        valid_orders.values("payment_method")
        .annotate(orders=Count("id"), total=Sum("total_amount"))
        .order_by("-total")
    )
    payment_mix = [
        {
            "method": row["payment_method"],
            "orders": int(row["orders"] or 0),
            "amount": float(quantize_inr(row["total"] or Decimal("0.00"))),
        }
        for row in payment_rows
    ]

    # 5. Top 5 Artisan Studios
    studio_rows = (
        valid_suborders.values(
            "seller_id",
            "seller__shop_name",
            "seller__city",
            "seller__rating_avg",
        )
        .annotate(
            gmv=Sum("subtotal_amount"),
            commission=Sum("commission_amount"),
            suborders=Count("id"),
        )
        .order_by("-gmv")[:5]
    )
    review_counts_by_seller = {
        r["seller_id"]: r["total"]
        for r in ProductReview.objects.filter(
            status=ProductReview.Status.PUBLISHED
        )
        .values("seller_id")
        .annotate(total=Count("id"))
    }
    top_studios = [
        {
            "shop_name": row["seller__shop_name"],
            "city": row["seller__city"] or "India",
            "gmv": f"{quantize_inr(row['gmv'] or Decimal('0.00')):.2f}",
            "commission": f"{quantize_inr(row['commission'] or Decimal('0.00')):.2f}",
            "suborders": int(row["suborders"] or 0),
            "rating_avg": f"{(row['seller__rating_avg'] or Decimal('0.00')):.2f}",
            "review_count": int(review_counts_by_seller.get(row["seller_id"], 0)),
        }
        for row in studio_rows
    ]

    # 6. Platform Quality & Settlement Metrics
    published_reviews = ProductReview.objects.filter(
        status=ProductReview.Status.PUBLISHED
    )
    rev_agg = published_reviews.aggregate(avg=Avg("rating"), total=Count("id"))
    platform_rating_avg = (
        Decimal(str(round(float(rev_agg["avg"]), 2)))
        if rev_agg["avg"] is not None
        else Decimal("0.00")
    )
    delivered_count = funnel_counts.get(SellerSuborder.FulfilmentStatus.DELIVERED, 0)
    returned_count = funnel_counts.get(SellerSuborder.FulfilmentStatus.RETURNED, 0)
    completed_denom = delivered_count + returned_count
    return_rate_pct = (
        round((returned_count / completed_denom) * 100, 1) if completed_denom > 0 else 0.0
    )

    total_paid_out = (
        SellerPayout.objects.filter(status=SellerPayout.Status.PAID).aggregate(
            total=Sum("amount")
        )["total"]
        or Decimal("0.00")
    )
    total_refunds_processed = (
        RefundRecord.objects.filter(status=RefundRecord.Status.PROCESSED).aggregate(
            total=Sum("amount")
        )["total"]
        or Decimal("0.00")
    )

    return {
        "monthly_performance": monthly_performance,
        "category_breakdown": category_breakdown,
        "fulfilment_funnel": fulfilment_funnel,
        "payment_mix": payment_mix,
        "top_studios": top_studios,
        "quality_metrics": {
            "platform_rating_avg": f"{platform_rating_avg:.2f}",
            "total_published_reviews": int(rev_agg["total"] or 0),
            "return_rate_pct": return_rate_pct,
            "total_paid_out": f"{quantize_inr(total_paid_out):.2f}",
            "total_refunds_processed": f"{quantize_inr(total_refunds_processed):.2f}",
        },
    }


def compute_seller_studio_analytics(seller_profile: SellerProfile) -> dict:
    """Live PostgreSQL analytics for an individual Seller studio."""
    valid_subs = SellerSuborder.objects.filter(seller=seller_profile).exclude(
        fulfilment_status__in=[
            SellerSuborder.FulfilmentStatus.PENDING_PAYMENT,
            SellerSuborder.FulfilmentStatus.CANCELLED,
        ]
    )
    buckets = _last_six_month_buckets()
    monthly_earnings = []
    for year, month, label in buckets:
        qs = valid_subs.filter(created_at__year=year, created_at__month=month)
        agg = qs.aggregate(
            gross=Sum("subtotal_amount"),
            net=Sum("net_seller_amount"),
            orders=Count("id"),
        )
        monthly_earnings.append(
            {
                "month": label,
                "gross_sales": float(quantize_inr(agg["gross"] or Decimal("0.00"))),
                "net_earnings": float(quantize_inr(agg["net"] or Decimal("0.00"))),
                "orders": int(agg["orders"] or 0),
            }
        )

    top_products = [
        {
            "product_title": row["product_title_snapshot"],
            "units_sold": int(row["units_sold"] or 0),
            "revenue": f"{quantize_inr(row['revenue'] or Decimal('0.00')):.2f}",
        }
        for row in OrderItem.objects.filter(suborder__in=valid_subs)
        .values("product_title_snapshot")
        .annotate(units_sold=Sum("quantity"), revenue=Sum("line_total"))
        .order_by("-revenue")[:5]
    ]

    pub_reviews = ProductReview.objects.filter(
        seller=seller_profile, status=ProductReview.Status.PUBLISHED
    )
    rev_agg = pub_reviews.aggregate(avg=Avg("rating"), count=Count("id"))
    rating_avg = (
        Decimal(str(round(float(rev_agg["avg"]), 2)))
        if rev_agg["avg"] is not None
        else Decimal("0.00")
    )
    return {
        "monthly_earnings": monthly_earnings,
        "top_products": top_products,
        "rating_avg": f"{rating_avg:.2f}",
        "review_count": int(rev_agg["count"] or 0),
    }
