"""Management command to audit Craftify production readiness without leaking any secrets."""
import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import connection

from apps.orders.razorpay_client import (
    get_razorpay_webhook_secret,
    is_razorpay_configured,
)

User = get_user_model()


class Command(BaseCommand):
    help = "Run a security & deployment readiness audit across DB, HTTPS, SMTP, Cloudinary, and Razorpay."

    def add_arguments(self, parser):
        parser.add_argument(
            "--strict",
            action="store_true",
            help="Exit with non-zero status if any check reports FAIL.",
        )

    def handle(self, *args, **options):
        strict = options["strict"]
        results = []

        def record(level: str, name: str, detail: str):
            results.append((level, name, detail))
            if level == "PASS":
                style = self.style.SUCCESS
            elif level == "WARN":
                style = self.style.WARNING
            else:
                style = self.style.ERROR
            self.stdout.write(style(f"[{level:4s}] {name}: {detail}"))

        self.stdout.write(self.style.MIGRATE_HEADING("Craftify Production Readiness Audit"))
        self.stdout.write("-" * 68)

        # 1. Database connectivity & engine
        db_engine = settings.DATABASES.get("default", {}).get("ENGINE", "")
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
            if "postgresql" in db_engine:
                record("PASS", "Database", "Connected to PostgreSQL.")
            else:
                record("WARN", "Database", f"Connected to {db_engine} (use PostgreSQL in production).")
        except Exception as exc:
            record("FAIL", "Database", f"Unable to connect ({exc.__class__.__name__}).")

        # 2. SECRET_KEY strength
        secret = getattr(settings, "SECRET_KEY", "") or ""
        if "dev-only-insecure" in secret or len(secret) < 32:
            record("FAIL", "Secret Key", "DJANGO_SECRET_KEY is weak or using the development fallback.")
        else:
            record("PASS", "Secret Key", f"Strong secret key configured ({len(secret)} chars).")

        # 3. DEBUG & ALLOWED_HOSTS
        if settings.DEBUG:
            record("WARN", "Debug Mode", "DEBUG=True (expected locally; must be False in production).")
        else:
            hosts = [h for h in settings.ALLOWED_HOSTS if h and h != "*"]
            if hosts:
                record("PASS", "Debug & Hosts", f"DEBUG=False; ALLOWED_HOSTS configured ({len(hosts)} host(s)).")
            else:
                record("FAIL", "Debug & Hosts", "DEBUG=False but ALLOWED_HOSTS is empty or wildcard.")

        # 4. HTTPS & Cookie Security
        proxy_header = getattr(settings, "SECURE_PROXY_SSL_HEADER", None)
        samesite = getattr(settings, "AUTH_REFRESH_COOKIE_SAMESITE", "Lax")
        if not settings.DEBUG:
            if proxy_header and getattr(settings, "SESSION_COOKIE_SECURE", False):
                record(
                    "PASS",
                    "HTTPS & Cookies",
                    f"Proxy TLS header active, Secure cookies enabled, Refresh SameSite={samesite}.",
                )
            else:
                record(
                    "FAIL",
                    "HTTPS & Cookies",
                    "Missing SECURE_PROXY_SSL_HEADER or SESSION_COOKIE_SECURE in production.",
                )
        else:
            record(
                "PASS",
                "HTTPS & Cookies",
                f"Local dev cookie policy active (Refresh SameSite={samesite}; prod enforces Secure+HSTS).",
            )

        # 5. Razorpay Checkout Keys
        if is_razorpay_configured():
            key_id = (os.getenv("RAZORPAY_KEY_ID") or "").strip()
            mode = "Live Mode" if key_id.startswith("rzp_live_") else "Test Mode"
            record("PASS", "Razorpay Keys", f"Configured ({mode}).")
        else:
            record("WARN", "Razorpay Keys", "Not configured (COD fallback only until keys are set).")

        # 6. Razorpay Live Webhook Secret
        if get_razorpay_webhook_secret():
            record("PASS", "Razorpay Webhook", "RAZORPAY_WEBHOOK_SECRET is configured.")
        else:
            record(
                "WARN",
                "Razorpay Webhook",
                "RAZORPAY_WEBHOOK_SECRET not set yet — configure after Render HTTPS deploy.",
            )

        # 7. Cloudinary Media Storage
        has_cloudinary = bool(
            (os.getenv("CLOUDINARY_URL") or "").strip()
            or (
                (os.getenv("CLOUDINARY_CLOUD_NAME") or "").strip()
                and (os.getenv("CLOUDINARY_API_KEY") or "").strip()
                and (os.getenv("CLOUDINARY_API_SECRET") or "").strip()
            )
        )
        if has_cloudinary:
            record("PASS", "Cloudinary Media", "Server-side signed upload credentials configured.")
        else:
            record("WARN", "Cloudinary Media", "Cloudinary credentials not set in environment.")

        # 8. SMTP Email Delivery
        email_backend = getattr(settings, "EMAIL_BACKEND", "")
        email_user = getattr(settings, "EMAIL_HOST_USER", "")
        email_host = getattr(settings, "EMAIL_HOST", "")
        if "smtp" in email_backend.lower() and email_user:
            record(
                "PASS",
                "SMTP Email",
                f"SMTP backend active ({email_host}:{getattr(settings, 'EMAIL_PORT', 587)}).",
            )
        else:
            record(
                "WARN",
                "SMTP Email",
                f"Using {email_backend.rsplit('.', 1)[-1]} — set EMAIL_HOST_USER & EMAIL_HOST_PASSWORD for live SMTP.",
            )

        # 9. Active Admin Account
        try:
            has_admin = User.objects.filter(role="ADMIN", is_active=True).exists()
            if has_admin:
                record("PASS", "Admin Account", "Active ADMIN user present.")
            else:
                record(
                    "WARN",
                    "Admin Account",
                    "No active ADMIN user found yet — run `python manage.py createsuperuser`.",
                )
        except Exception:
            record("WARN", "Admin Account", "Could not query users table (run migrations first).")

        passes = sum(1 for lvl, _, _ in results if lvl == "PASS")
        warns = sum(1 for lvl, _, _ in results if lvl == "WARN")
        fails = sum(1 for lvl, _, _ in results if lvl == "FAIL")

        self.stdout.write("-" * 68)
        summary = f"Summary: {passes} PASS | {warns} WARN | {fails} FAIL"
        if fails:
            self.stdout.write(self.style.ERROR(summary))
            if strict:
                raise CommandError("Production readiness audit failed with one or more FAIL items.")
        elif warns:
            self.stdout.write(self.style.WARNING(summary))
        else:
            self.stdout.write(self.style.SUCCESS(summary))
