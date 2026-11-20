"""Authoritative backend Role-Based Access Control (RBAC) permission classes."""
from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    """Allow access strictly to authenticated platform administrators."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and request.user.role == "ADMIN"
        )


class IsApprovedSellerRole(BasePermission):
    """Allow access strictly to authenticated users with approved SELLER role."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and request.user.role == "SELLER"
        )


class IsBuyerRole(BasePermission):
    """Allow access to authenticated BUYER accounts (or sellers purchasing as buyers)."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.is_active
            and request.user.role in ("BUYER", "SELLER")
        )
