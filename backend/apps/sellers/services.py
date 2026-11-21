"""Transactional domain services for seller onboarding, Admin review, and governance."""
import os

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify
from rest_framework.exceptions import PermissionDenied, ValidationError

from apps.accounts.models import User
from apps.accounts.services import revoke_all_user_tokens
from apps.audit.services import record_audit_log
from apps.sellers.models import (
    SellerApplication,
    SellerProfile,
    SellerVerificationDocument,
)


class ConflictError(ValidationError):
    """Domain conflict error mapped cleanly to HTTP 409 in views."""

    status_code = 409


def _generate_unique_shop_slug(shop_name: str) -> str:
    base_slug = slugify(shop_name)[:140] or "craftify-studio"
    candidate = base_slug
    counter = 1
    while SellerProfile.objects.filter(slug=candidate).exists():
        counter += 1
        candidate = f"{base_slug}-{counter}"
    return candidate


def _ensure_unique_shop_name(shop_name: str) -> str:
    cleaned = shop_name.strip()
    if SellerProfile.objects.filter(shop_name__iexact=cleaned).exists():
        raise ConflictError(
            {"shop_name": ["A verified Craftify studio with this shop name already exists."]}
        )
    return cleaned


@transaction.atomic
def submit_seller_application(*, user: User, validated_data: dict, request=None) -> SellerApplication:
    """
    Create a new SellerApplication for a verified BUYER along with optional verification doc.
    """
    if user.role != User.Role.BUYER:
        raise PermissionDenied("Only Buyer accounts can submit a seller application.")

    if not user.is_email_verified:
        raise PermissionDenied(
            "Please verify your email address before applying to become a seller."
        )

    if SellerApplication.objects.filter(
        user=user, status=SellerApplication.Status.PENDING
    ).exists():
        raise ConflictError(
            {"detail": "You already have a seller application pending Admin review."}
        )

    if SellerProfile.objects.filter(user=user).exists():
        raise ConflictError(
            {"detail": "Your account already has an approved seller studio."}
        )

    shop_name = _ensure_unique_shop_name(validated_data["shop_name"])
    uploaded_file = validated_data.pop("document_file", None)
    doc_type = validated_data.pop(
        "doc_type", SellerVerificationDocument.DocType.PAN_CARD
    )

    application = SellerApplication.objects.create(
        user=user,
        shop_name=shop_name,
        primary_category=validated_data["primary_category"],
        bio=validated_data["bio"],
        pickup_address=validated_data["pickup_address"],
        city=validated_data["city"],
        state=validated_data["state"],
        pincode=validated_data["pincode"],
        pan_number=validated_data["pan_number"],
        gstin=validated_data.get("gstin", ""),
        bank_account_masked=validated_data.get("bank_account_masked", ""),
        ifsc_code=validated_data.get("ifsc_code", ""),
        accepted_agreement=True,
        status=SellerApplication.Status.PENDING,
    )

    if uploaded_file is not None:
        safe_original_name = os.path.basename(uploaded_file.name or "document")[:200]
        SellerVerificationDocument.objects.create(
            application=application,
            doc_type=doc_type,
            file=uploaded_file,
            original_filename=safe_original_name,
            file_size_bytes=uploaded_file.size or 0,
        )

    record_audit_log(
        actor=user,
        action="SELLER_APPLICATION_SUBMITTED",
        target_model="SellerApplication",
        target_id=application.id,
        summary=f"Buyer @{user.username} applied to open studio '{application.shop_name}'.",
        metadata={"city": application.city, "state": application.state},
        request=request,
    )
    return application


@transaction.atomic
def review_seller_application(
    *,
    admin_user: User,
    application_id,
    action: str,
    review_notes: str = "",
    request=None,
) -> SellerApplication:
    """
    Atomically approve or reject a pending SellerApplication.
    On approval: promotes applicant role to SELLER, creates SellerProfile, and writes AuditLog.
    """
    application = (
        SellerApplication.objects.select_for_update()
        .select_related("user")
        .filter(id=application_id)
        .first()
    )
    if application is None:
        raise ValidationError({"detail": "Seller application not found."})

    if application.status != SellerApplication.Status.PENDING:
        raise ConflictError(
            {
                "detail": f"This application has already been {application.status.lower()}."
            }
        )

    now = timezone.now()
    cleaned_notes = (review_notes or "").strip()

    if action == "REJECT":
        if not cleaned_notes:
            raise ValidationError(
                {"review_notes": ["Please provide a clear reason when rejecting an application."]}
            )
        application.status = SellerApplication.Status.REJECTED
        application.reviewed_by = admin_user
        application.reviewed_at = now
        application.review_notes = cleaned_notes
        application.save(
            update_fields=[
                "status",
                "reviewed_by",
                "reviewed_at",
                "review_notes",
                "updated_at",
            ]
        )
        record_audit_log(
            actor=admin_user,
            action="SELLER_APPLICATION_REJECTED",
            target_model="SellerApplication",
            target_id=application.id,
            summary=f"Rejected seller application '{application.shop_name}' (@{application.user.username}).",
            metadata={"review_notes": cleaned_notes},
            request=request,
        )
        return application

    if action == "APPROVE":
        applicant = User.objects.select_for_update().get(id=application.user_id)
        if not applicant.is_active:
            raise ValidationError(
                {"detail": "Cannot approve a seller application for a suspended user account."}
            )
        if SellerProfile.objects.filter(user=applicant).exists():
            raise ConflictError(
                {"detail": "This user already owns an approved SellerProfile."}
            )
        _ensure_unique_shop_name(application.shop_name)

        application.status = SellerApplication.Status.APPROVED
        application.reviewed_by = admin_user
        application.reviewed_at = now
        application.review_notes = cleaned_notes or "Approved by Craftify Admin."
        application.save(
            update_fields=[
                "status",
                "reviewed_by",
                "reviewed_at",
                "review_notes",
                "updated_at",
            ]
        )

        application.documents.filter(verified_at__isnull=True).update(verified_at=now)

        # Promote Buyer -> Seller in PostgreSQL
        applicant.role = User.Role.SELLER
        applicant.save(update_fields=["role", "updated_at"])

        profile = SellerProfile.objects.create(
            user=applicant,
            application=application,
            shop_name=application.shop_name,
            slug=_generate_unique_shop_slug(application.shop_name),
            primary_category=application.primary_category,
            description=application.bio,
            city=application.city,
            state=application.state,
            pickup_address_json={
                "line1": application.pickup_address,
                "city": application.city,
                "state": application.state,
                "pincode": application.pincode,
            },
            bank_account_masked=application.bank_account_masked,
            ifsc_code=application.ifsc_code,
            agreement_accepted_at=application.created_at,
        )

        record_audit_log(
            actor=admin_user,
            action="SELLER_APPLICATION_APPROVED",
            target_model="SellerProfile",
            target_id=profile.id,
            summary=(
                f"Approved seller studio '{profile.shop_name}' and promoted "
                f"@{applicant.username} to SELLER."
            ),
            metadata={"application_id": str(application.id)},
            request=request,
        )
        return application

    raise ValidationError({"action": ["Action must be either APPROVE or REJECT."]})


@transaction.atomic
def toggle_seller_suspension(
    *, admin_user: User, seller_profile_id, reason: str = "", request=None
) -> SellerProfile:
    """Suspend or reinstate an approved SellerProfile and record an AuditLog."""
    profile = (
        SellerProfile.objects.select_for_update()
        .select_related("user")
        .filter(id=seller_profile_id)
        .first()
    )
    if profile is None:
        raise ValidationError({"detail": "Seller profile not found."})

    new_state = not profile.is_suspended
    profile.is_suspended = new_state
    profile.suspension_reason = (reason or "").strip()[:255] if new_state else ""
    profile.save(update_fields=["is_suspended", "suspension_reason", "updated_at"])

    record_audit_log(
        actor=admin_user,
        action="SELLER_SUSPENDED" if new_state else "SELLER_REINSTATED",
        target_model="SellerProfile",
        target_id=profile.id,
        summary=(
            f"{'Suspended' if new_state else 'Reinstated'} seller studio "
            f"'{profile.shop_name}' (@{profile.user.username})."
        ),
        metadata={"reason": profile.suspension_reason},
        request=request,
    )
    return profile


@transaction.atomic
def toggle_user_active_status(
    *, admin_user: User, target_user_id, reason: str = "", request=None
) -> User:
    """Suspend or reactivate a non-admin user account and revoke sessions on suspension."""
    target = User.objects.select_for_update().filter(id=target_user_id).first()
    if target is None:
        raise ValidationError({"detail": "User not found."})

    if target.id == admin_user.id or target.role == User.Role.ADMIN:
        raise PermissionDenied("Admin accounts cannot be suspended from this endpoint.")

    target.is_active = not target.is_active
    target.save(update_fields=["is_active", "updated_at"])

    if not target.is_active:
        revoke_all_user_tokens(target)

    record_audit_log(
        actor=admin_user,
        action="USER_ACTIVATED" if target.is_active else "USER_SUSPENDED",
        target_model="User",
        target_id=target.id,
        summary=(
            f"{'Activated' if target.is_active else 'Suspended'} account "
            f"@{target.username} ({target.role})."
        ),
        metadata={"reason": (reason or "").strip()[:255]},
        request=request,
    )
    return target
