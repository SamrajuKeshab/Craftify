"""
Secure management command to create the initial Craftify Admin user.
Usage:
    python manage.py create_initial_admin
Never hardcode admin passwords in source code or migrations.
"""
import getpass
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

User = get_user_model()


class Command(BaseCommand):
    help = "Create an authorized Craftify ADMIN account interactively (no hardcoded credentials)."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Craftify Secure Admin Account Setup"))

        username = input("Admin username: ").strip()
        full_name = input("Full name: ").strip()
        email = input("Email address: ").strip().lower()

        if not username or not full_name or not email:
            raise CommandError("Username, full name, and email are all required.")

        if User.objects.filter(username__iexact=username).exists():
            raise CommandError(f"Username '{username}' already exists.")
        if User.objects.filter(email__iexact=email).exists():
            raise CommandError(f"Email '{email}' already exists.")

        password = getpass.getpass("Password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            raise CommandError("Passwords do not match.")

        try:
            validate_password(password)
        except ValidationError as exc:
            raise CommandError("; ".join(exc.messages)) from exc

        admin_user = User.objects.create_user(
            username=username,
            email=email,
            full_name=full_name,
            password=password,
            role=User.Role.ADMIN,
            is_staff=True,
            is_superuser=True,
            is_email_verified=True,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Created Craftify Admin '{admin_user.username}' (redirect: {admin_user.get_dashboard_redirect_url()})."
            )
        )
