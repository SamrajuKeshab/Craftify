"""Serializers for seller onboarding, verification docs, profiles, and Admin panel."""
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import User
from apps.audit.models import AuditLog
from apps.sellers.models import (
    SellerApplication,
    SellerProfile,
    SellerVerificationDocument,
)
from apps.sellers.validators import (
    mask_bank_account,
    validate_gstin,
    validate_ifsc_code,
    validate_indian_pincode,
    validate_pan_number,
    validate_verification_document,
)


class SellerVerificationDocumentSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = SellerVerificationDocument
        fields = (
            "id",
            "doc_type",
            "original_filename",
            "file_size_bytes",
            "verified_at",
            "download_url",
            "created_at",
        )
        read_only_fields = fields

    def get_download_url(self, obj) -> str:
        return f"/api/v1/sellers/documents/{obj.id}/"


class SellerApplicationCreateSerializer(serializers.Serializer):
    shop_name = serializers.CharField(max_length=140, min_length=3)
    primary_category = serializers.CharField(max_length=100)
    bio = serializers.CharField(min_length=20, max_length=2000)
    pickup_address = serializers.CharField(min_length=5, max_length=255)
    city = serializers.CharField(min_length=2, max_length=100)
    state = serializers.CharField(min_length=2, max_length=100)
    pincode = serializers.CharField(max_length=6)
    pan_number = serializers.CharField(max_length=10)
    gstin = serializers.CharField(max_length=15, required=False, allow_blank=True, default="")
    bank_account_number = serializers.CharField(
        max_length=24, required=False, allow_blank=True, default=""
    )
    ifsc_code = serializers.CharField(
        max_length=11, required=False, allow_blank=True, default=""
    )
    accepted_agreement = serializers.BooleanField()
    doc_type = serializers.ChoiceField(
        choices=SellerVerificationDocument.DocType.choices,
        required=False,
        default=SellerVerificationDocument.DocType.PAN_CARD,
    )
    document_file = serializers.FileField(required=False, allow_null=True)

    def validate_shop_name(self, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 3:
            raise serializers.ValidationError("Shop name must be at least 3 characters.")
        return cleaned

    def validate_pincode(self, value: str) -> str:
        try:
            return validate_indian_pincode(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)

    def validate_pan_number(self, value: str) -> str:
        try:
            return validate_pan_number(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)

    def validate_gstin(self, value: str) -> str:
        try:
            return validate_gstin(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)

    def validate_ifsc_code(self, value: str) -> str:
        try:
            return validate_ifsc_code(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)

    def validate_bank_account_number(self, value: str) -> str:
        try:
            return mask_bank_account(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)

    def validate_accepted_agreement(self, value: bool) -> bool:
        if not value:
            raise serializers.ValidationError(
                "You must accept the Craftify handmade authenticity and settlement agreement."
            )
        return value

    def validate_document_file(self, uploaded_file):
        try:
            validate_verification_document(uploaded_file)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)
        return uploaded_file

    def validate(self, attrs):
        # Convert bank_account_number into bank_account_masked so raw numbers are never persisted
        masked = attrs.pop("bank_account_number", "")
        attrs["bank_account_masked"] = masked
        return attrs


class SellerApplicationSerializer(serializers.ModelSerializer):
    applicant_username = serializers.CharField(source="user.username", read_only=True)
    applicant_full_name = serializers.CharField(source="user.full_name", read_only=True)
    applicant_email = serializers.EmailField(source="user.email", read_only=True)
    applicant_is_email_verified = serializers.BooleanField(
        source="user.is_email_verified", read_only=True
    )
    reviewed_by_username = serializers.CharField(
        source="reviewed_by.username", read_only=True, default=None
    )
    documents = SellerVerificationDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = SellerApplication
        fields = (
            "id",
            "applicant_username",
            "applicant_full_name",
            "applicant_email",
            "applicant_is_email_verified",
            "shop_name",
            "primary_category",
            "bio",
            "pickup_address",
            "city",
            "state",
            "pincode",
            "pan_number",
            "gstin",
            "bank_account_masked",
            "ifsc_code",
            "accepted_agreement",
            "status",
            "reviewed_by_username",
            "reviewed_at",
            "review_notes",
            "documents",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class SellerApplicationReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["APPROVE", "REJECT"])
    review_notes = serializers.CharField(
        required=False, allow_blank=True, max_length=1000, default=""
    )


class SellerProfileSerializer(serializers.ModelSerializer):
    owner_username = serializers.CharField(source="user.username", read_only=True)
    owner_full_name = serializers.CharField(source="user.full_name", read_only=True)
    owner_email = serializers.EmailField(source="user.email", read_only=True)
    owner_is_active = serializers.BooleanField(source="user.is_active", read_only=True)

    class Meta:
        model = SellerProfile
        fields = (
            "id",
            "owner_username",
            "owner_full_name",
            "owner_email",
            "owner_is_active",
            "shop_name",
            "slug",
            "primary_category",
            "description",
            "city",
            "state",
            "pickup_address_json",
            "bank_account_masked",
            "ifsc_code",
            "agreement_accepted_at",
            "is_suspended",
            "suspension_reason",
            "rating_avg",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "owner_username",
            "owner_full_name",
            "owner_email",
            "owner_is_active",
            "slug",
            "agreement_accepted_at",
            "is_suspended",
            "suspension_reason",
            "rating_avg",
            "created_at",
            "updated_at",
        )


class SellerShopUpdateSerializer(serializers.ModelSerializer):
    """Seller-editable subset of SellerProfile; blocks tampering with suspension or ratings."""

    bank_account_number = serializers.CharField(
        max_length=24, required=False, allow_blank=True, write_only=True
    )

    class Meta:
        model = SellerProfile
        fields = (
            "shop_name",
            "primary_category",
            "description",
            "city",
            "state",
            "pickup_address_json",
            "bank_account_number",
            "ifsc_code",
        )

    def validate_shop_name(self, value: str) -> str:
        cleaned = value.strip()
        qs = SellerProfile.objects.filter(shop_name__iexact=cleaned)
        if self.instance is not None:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Another Craftify studio already uses this shop name.")
        return cleaned

    def validate_ifsc_code(self, value: str) -> str:
        try:
            return validate_ifsc_code(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)

    def validate_bank_account_number(self, value: str) -> str:
        try:
            return mask_bank_account(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages)

    def update(self, instance, validated_data):
        masked_bank = validated_data.pop("bank_account_number", None)
        if masked_bank:
            instance.bank_account_masked = masked_bank
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        return instance


class AdminBuyerListSerializer(serializers.ModelSerializer):
    latest_application_status = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "email",
            "role",
            "is_email_verified",
            "is_active",
            "created_at",
            "latest_application_status",
        )
        read_only_fields = fields

    def get_latest_application_status(self, obj):
        latest = obj.seller_applications.first()
        return latest.status if latest else None


class AdminAuditLogSerializer(serializers.ModelSerializer):
    actor_username = serializers.CharField(source="actor.username", read_only=True)
    actor_role = serializers.CharField(source="actor.role", read_only=True)

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor_username",
            "actor_role",
            "action",
            "target_model",
            "target_id",
            "summary",
            "metadata_json",
            "ip_address",
            "created_at",
        )
        read_only_fields = fields
