"""Server-side Razorpay REST client and constant-time HMAC-SHA256 verification."""
import base64
import hashlib
import hmac
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

from django.conf import settings
from rest_framework.exceptions import ValidationError

RAZORPAY_ORDERS_API_URL = "https://api.razorpay.com/v1/orders"

_PLACEHOLDER_MARKERS = (
    "your_key_id",
    "your_razorpay_test_secret",
    "your_razorpay_webhook_secret",
    "replace-this",
)


def _is_placeholder(value: str) -> bool:
    v = (value or "").strip()
    if not v:
        return True
    lowered = v.lower()
    return any(marker in lowered for marker in _PLACEHOLDER_MARKERS)


def _read_dotenv_values() -> dict[str, str]:
    """Read key=value entries from backend/.env dynamically as a fallback."""
    env_path = Path(settings.BASE_DIR) / ".env"
    parsed: dict[str, str] = {}
    if not env_path.is_file():
        return parsed
    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if key:
                parsed[key] = val
    except OSError:
        return {}
    return parsed


def _get_env_value(key: str) -> str:
    val = (os.getenv(key) or "").strip()
    if not _is_placeholder(val):
        return val
    dotenv_val = (_read_dotenv_values().get(key) or "").strip()
    if not _is_placeholder(dotenv_val):
        os.environ[key] = dotenv_val
        return dotenv_val
    return ""


def get_razorpay_credentials() -> tuple[str, str]:
    """Return (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) or raise a clear ValidationError."""
    key_id = _get_env_value("RAZORPAY_KEY_ID")
    key_secret = _get_env_value("RAZORPAY_KEY_SECRET")

    missing = []
    if not key_id:
        missing.append("RAZORPAY_KEY_ID")
    if not key_secret:
        missing.append("RAZORPAY_KEY_SECRET")

    if missing:
        raise ValidationError(
            f"Razorpay test credentials ({', '.join(missing)}) are not configured in "
            "backend/.env. Add your Razorpay Test Key ID & Secret (or use Cash on Delivery "
            "for orders up to ₹5,000)."
        )
    return key_id, key_secret


def is_razorpay_configured() -> bool:
    return bool(_get_env_value("RAZORPAY_KEY_ID") and _get_env_value("RAZORPAY_KEY_SECRET"))


def get_razorpay_webhook_secret() -> str:
    return _get_env_value("RAZORPAY_WEBHOOK_SECRET")


def create_razorpay_order(*, amount_paise: int, receipt: str, notes: dict | None = None) -> dict:
    """
    Create an authoritative Razorpay Order server-side via Razorpay REST API.
    Uses Basic Auth with RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET (never exposed to client).
    """
    key_id, key_secret = get_razorpay_credentials()
    auth_token = base64.b64encode(f"{key_id}:{key_secret}".encode("utf-8")).decode("ascii")

    payload = json.dumps(
        {
            "amount": int(amount_paise),
            "currency": "INR",
            "receipt": receipt[:40],
            "payment_capture": 1,
            "notes": notes or {},
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        RAZORPAY_ORDERS_API_URL,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Basic {auth_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            if not body.get("id"):
                raise ValidationError("Razorpay did not return an order ID. Please retry.")
            return {
                "razorpay_order_id": body["id"],
                "amount_paise": int(body.get("amount", amount_paise)),
                "currency": body.get("currency", "INR"),
                "key_id": key_id,
            }
    except urllib.error.HTTPError as exc:
        err_msg = "Razorpay rejected the payment order request."
        try:
            err_body = json.loads(exc.read().decode("utf-8"))
            desc = err_body.get("error", {}).get("description")
            if desc:
                err_msg = f"Razorpay error: {desc}"
        except Exception:
            pass
        raise ValidationError(err_msg)
    except urllib.error.URLError:
        raise ValidationError(
            "Unable to reach Razorpay servers right now. Please try again or choose Cash on Delivery."
        )


def verify_razorpay_checkout_signature(
    *, razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str
) -> bool:
    """Verify Razorpay Checkout HMAC-SHA256 signature using constant-time comparison."""
    _, key_secret = get_razorpay_credentials()
    message = f"{razorpay_order_id}|{razorpay_payment_id}".encode("utf-8")
    expected = hmac.new(key_secret.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, (razorpay_signature or "").strip())


def verify_razorpay_webhook_signature(*, raw_body: bytes, signature_header: str) -> bool:
    """Verify Razorpay X-Razorpay-Signature webhook HMAC-SHA256 using constant-time comparison."""
    webhook_secret = get_razorpay_webhook_secret()
    if not webhook_secret or not signature_header:
        return False
    expected = hmac.new(
        webhook_secret.encode("utf-8"), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header.strip())
