"""Serializers for Craftify authentication and user profile endpoints."""
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    """Safe public/self representation of an authenticated Craftify user."""

    redirect_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "full_name",
            "email",
            "role",
            "is_email_verified",
            "redirect_url",
            "created_at",
        )
        read_only_fields = ("id", "role", "is_email_verified", "redirect_url", "created_at")

    def get_redirect_url(self, obj):
        return obj.get_dashboard_redirect_url()


class RegisterSerializer(serializers.ModelSerializer):
    """
    Public Sign-Up serializer.
    Security guarantee: Ignores any role input and ALWAYS assigns BUYER role.
    """

    password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("full_name", "username", "email", "password", "confirm_password")

    def validate_email(self, value):
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return normalized

    def validate_username(self, value):
        cleaned = value.strip()
        if User.objects.filter(username__iexact=cleaned).exists():
            raise serializers.ValidationError("This username is already taken.")
        return cleaned

    def validate(self, attrs):
        if attrs["password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(attrs["password"])
        return attrs

    def create(self, validated_data):
        validated_data.pop("confirm_password")
        password = validated_data.pop("password")
        # Force BUYER role on every public registration (never trust client input)
        user = User(
            full_name=validated_data["full_name"].strip(),
            username=validated_data["username"],
            email=validated_data["email"],
            role=User.Role.BUYER,
        )
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    """
    Unified Login serializer (Username + Password only).
    Resolves user role authoritatively from PostgreSQL and returns JWT tokens + redirect_url.
    """

    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        username = attrs.get("username", "").strip()
        password = attrs.get("password", "")
        user = authenticate(username=username, password=password)

        # Identical error message prevents account enumeration
        if not user or not user.is_active:
            raise serializers.ValidationError("Invalid username or password.")

        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserProfileSerializer(user).data,
            "redirect_url": user.get_dashboard_redirect_url(),
        }
