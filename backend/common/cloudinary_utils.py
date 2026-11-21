"""Server-side Cloudinary upload & cleanup utilities with strict image validation."""
import logging
import os

from pathlib import Path

import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv
from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

logger = logging.getLogger(__name__)

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

BACKEND_ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
ROOT_ENV_PATH = BACKEND_ENV_PATH.parent.parent / ".env"


def _is_placeholder(value: str) -> bool:
    cleaned = value.strip().strip('"').strip("'").lower()
    if not cleaned:
        return True
    return (
        cleaned.startswith("your_")
        or cleaned.startswith("<")
        or "your_cloud_name" in cleaned
        or "your_api_key" in cleaned
        or "your_api_secret" in cleaned
    )


def _read_cloudinary_env() -> tuple[str, str, str, str]:
    cloudinary_url = (os.getenv("CLOUDINARY_URL") or "").strip().strip('"').strip("'")
    cloud_name = (os.getenv("CLOUDINARY_CLOUD_NAME") or "").strip().strip('"').strip("'")
    api_key = (os.getenv("CLOUDINARY_API_KEY") or "").strip().strip('"').strip("'")
    api_secret = (os.getenv("CLOUDINARY_API_SECRET") or "").strip().strip('"').strip("'")
    return cloudinary_url, cloud_name, api_key, api_secret


def _missing_cloudinary_fields() -> list[str]:
    cloudinary_url, cloud_name, api_key, api_secret = _read_cloudinary_env()
    if cloudinary_url and not _is_placeholder(cloudinary_url):
        return []
    missing = []
    if _is_placeholder(cloud_name):
        missing.append("CLOUDINARY_CLOUD_NAME")
    if _is_placeholder(api_key):
        missing.append("CLOUDINARY_API_KEY")
    if _is_placeholder(api_secret):
        missing.append("CLOUDINARY_API_SECRET")
    return missing


def configure_cloudinary() -> bool:
    """
    Configure Cloudinary strictly from server-side environment variables.
    Supports either CLOUDINARY_URL or the three individual CLOUDINARY_* keys.
    Re-reads backend/.env if credentials are currently missing so edits to .env
    work immediately during local development.
    """
    if _missing_cloudinary_fields():
        if BACKEND_ENV_PATH.is_file():
            load_dotenv(BACKEND_ENV_PATH, override=True)
        elif ROOT_ENV_PATH.is_file():
            load_dotenv(ROOT_ENV_PATH, override=True)

    cloudinary_url, cloud_name, api_key, api_secret = _read_cloudinary_env()

    if cloudinary_url and not _is_placeholder(cloudinary_url):
        cloudinary.config(cloudinary_url=cloudinary_url, secure=True)
        return True

    if (
        not _is_placeholder(cloud_name)
        and not _is_placeholder(api_key)
        and not _is_placeholder(api_secret)
    ):
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True,
        )
        return True

    return False


def validate_image_file(uploaded_file) -> None:
    """Validate uploaded image size, extension, MIME type, and actual image headers via Pillow."""
    if uploaded_file is None:
        return

    if uploaded_file.size > MAX_IMAGE_SIZE_BYTES:
        raise ValidationError("Image file must be 5 MB or smaller.")

    _, ext = os.path.splitext(uploaded_file.name or "")
    if ext.lower() not in ALLOWED_IMAGE_EXTENSIONS:
        raise ValidationError("Only JPG, JPEG, PNG, and WEBP image files are allowed.")

    content_type = (getattr(uploaded_file, "content_type", "") or "").lower()
    if content_type and content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise ValidationError("Unsupported image content type. Use JPG, PNG, or WEBP.")

    # Verify the uploaded bytes are a genuine decodable image
    try:
        uploaded_file.seek(0)
        with Image.open(uploaded_file) as img:
            img.verify()
        uploaded_file.seek(0)
    except (UnidentifiedImageError, OSError, ValueError):
        raise ValidationError("Uploaded file is not a valid image.")


def upload_image_to_cloudinary(uploaded_file, *, folder: str = "craftify/products") -> dict:
    """
    Validate and upload an image file to Cloudinary using server-side credentials.
    Returns dict with `image_url` (HTTPS secure_url) and `cloudinary_public_id`.
    """
    validate_image_file(uploaded_file)

    if not configure_cloudinary():
        missing = _missing_cloudinary_fields()
        missing_text = ", ".join(missing) if missing else "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET"
        raise ValidationError(
            f"Cloudinary setup incomplete in backend/.env — missing or placeholder value(s): {missing_text}. "
            "Open Cloudinary Dashboard → Settings → API Keys, paste all 3 values into backend/.env, and try again."
        )

    try:
        uploaded_file.seek(0)
        result = cloudinary.uploader.upload(
            uploaded_file,
            folder=folder,
            resource_type="image",
            unique_filename=True,
            overwrite=False,
        )
    except Exception as exc:
        logger.warning("Cloudinary image upload failed: %s", exc)
        raise ValidationError(
            "Could not upload image to Cloudinary. Verify your Cloudinary credentials in backend/.env."
        )

    secure_url = result.get("secure_url")
    public_id = result.get("public_id")
    if not secure_url or not public_id:
        raise ValidationError("Unexpected response from Cloudinary during image upload.")

    return {
        "image_url": secure_url,
        "cloudinary_public_id": public_id,
    }


def delete_cloudinary_asset(public_id: str) -> None:
    """Best-effort cleanup of an old image asset from Cloudinary."""
    if not public_id:
        return
    if not configure_cloudinary():
        return
    try:
        cloudinary.uploader.destroy(public_id, resource_type="image")
    except Exception as exc:
        logger.warning("Failed to delete Cloudinary asset %s: %s", public_id, exc)
