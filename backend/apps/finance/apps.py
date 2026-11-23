"""Django app config for Craftify Financial Ledger, Refunds & Seller Payouts."""
from django.apps import AppConfig


class FinanceConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.finance"
    verbose_name = "Financial Ledger, Refunds & Payouts"
