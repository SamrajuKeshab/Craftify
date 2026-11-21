"""Validation helpers for Indian KYC fields and safe verification document uploads."""
import os
import re
import uuid

from django.core.exceptions import ValidationError

PAN_REGEX = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
GSTIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")
PINCODE_REGEX = re.compile(r"^[1-9][0-9]{5}$")

ALLOWED_DOC_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
ALLOWED_DOC_CONTENT_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}
MAX_DOC_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


def validate_pan_number(value: str) -> str:
    cleaned = (value or "").strip().upper()
    if not PAN_REGEX.match(cleaned):
        raise ValidationError(
            "Enter a valid 10-character Indian PAN number (e.g., ABCDE1234F)."
        )
    return cleaned


def validate_gstin(value: str) -> str:
    cleaned = (value or "").strip().upper()
    if not cleaned:
        return ""
    if not GSTIN_REGEX.match(cleaned):
        raise ValidationError(
            "Enter a valid 15-character Indian GSTIN (e.g., 22AAAAA0000A1Z5)."
        )
    return cleaned


def validate_ifsc_code(value: str) -> str:
    cleaned = (value or "").strip().upper()
    if not cleaned:
        return ""
    if not IFSC_REGEX.match(cleaned):
        raise ValidationError(
            "Enter a valid 11-character Indian IFSC code (e.g., SBIN0001234)."
        )
    return cleaned


def validate_indian_pincode(value: str) -> str:
    cleaned = (value or "").strip()
    if not PINCODE_REGEX.match(cleaned):
        raise ValidationError("Enter a valid 6-digit Indian pincode.")
    return cleaned


def mask_bank_account(account_number: str) -> str:
    """Mask bank account number so only the last 4 digits are retained for display."""
    digits = re.sub(r"\D", "", account_number or "")
    if not digits:
        return ""
    if len(digits) < 6 or len(digits) > 18:
        raise ValidationError("Bank account number must contain between 6 and 18 digits.")
    return f"{'X' * (len(digits) - 4)}{digits[-4:]}"


def validate_verification_document(uploaded_file) -> None:
    """Validate file size, extension, and MIME type for seller verification uploads."""
    if uploaded_file is None:
        return
    if uploaded_file.size > MAX_DOC_SIZE_BYTES:
        raise ValidationError("Verification document must be 5 MB or smaller.")

    _, ext = os.path.splitext(uploaded_file.name or "")
    ext_lower = ext.lower()
    if ext_lower not in ALLOWED_DOC_EXTENSIONS:
        raise ValidationError(
            "Only PDF, JPG, JPEG, and PNG verification documents are allowed."
        )

    content_type = getattr(uploaded_file, "content_type", "") or ""
    if content_type and content_type.lower() not in ALLOWED_DOC_CONTENT_TYPES:
        raise ValidationError(
            "Unsupported file MIME type. Upload a valid PDF, JPG, or PNG file."
        )


def verification_document_upload_path(instance, filename: str) -> str:
    """Generate a non-predictable UUID path under MEDIA_ROOT to prevent traversal."""
    _, ext = os.path.splitext(filename or "")
    safe_ext = ext.lower() if ext.lower() in ALLOWED_DOC_EXTENSIONS else ".bin"
    return f"seller_verification_docs/{uuid.uuid4().hex}{safe_ext}"
