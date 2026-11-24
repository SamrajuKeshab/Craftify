"""Production-grade HTTP security headers middleware for Craftify API."""

SENSITIVE_NO_STORE_PREFIXES = (
    "/api/v1/auth/",
    "/api/v1/payments/",
    "/api/v1/admin/",
    "/api/v1/seller/finance/",
    "/api/v1/buyer/refunds/",
)


class SecurityHeadersMiddleware:
    """
    Attaches defense-in-depth browser & proxy security headers to every response.
    - Prevents MIME sniffing and enforces strict referrer & permissions policies.
    - Keeps Cross-Origin-Opener-Policy compatible with Razorpay Checkout popups.
    - Prevents intermediate caches from storing auth tokens or financial PII.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        response.setdefault("X-Content-Type-Options", "nosniff")
        response.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self)",
        )
        response.setdefault("Cross-Origin-Opener-Policy", "same-origin-allow-popups")

        if any(request.path.startswith(prefix) for prefix in SENSITIVE_NO_STORE_PREFIXES):
            response["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response["Pragma"] = "no-cache"

        return response
