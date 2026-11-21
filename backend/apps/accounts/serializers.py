"""Serializers for Craftify authentication, verification, password recovery, and profile."""
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class UserProfileSerializer(serializers.ModelSerializer):
    """Safe representation of an authenticated Craftify user."""

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
        read_only_fields = (
            "id",
            "role",
            "is_email_verified",
            "redirect_url",
            "created_at",
        )

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
        user = User(
            full_name=validated_data["full_name"].strip(),
            username=validated_data["username"],
            email=validated_data["email"],
            role=User.Role.BUYER,
            is_email_verified=False,
        )
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    """
    Unified Login serializer (Username + Password only).
    Enforces brute-force lockout (5 consecutive failures -> 15 min lock),
    blocks suspended accounts, and resolves authoritative DB role redirect.
    """

    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs):
        username = attrs.get("username", "").strip()
        password = attrs.get("password", "")

        candidate = User.objects.filter(username__iexact=username).first()

        # Check temporary brute-force lockout before password verification
        if candidate and candidate.is_locked():
            raise serializers.ValidationError(
                "Too many failed login attempts. Please try again in 15 minutes or reset your password."
            )

        user = authenticate(username=candidate.username if candidate else username, password=password)

        if not user or not user.is_active:
            if candidate and candidate.is_active:
                candidate.register_failed_login()
            # Identical message prevents account enumeration
            raise serializers.ValidationError("Invalid username or password.")

        user.clear_failed_logins()
        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserProfileSerializer(user).data,
            "redirect_url": user.get_dashboard_redirect_url(),
        }


class VerifyEmailSerializer(serializers.Serializer):
    token = serializers.CharField(min_length=16, max_length=256)


class PasswordResetRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField(min_length=16, max_length=256)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        validate_password(attrs["new_password"])
        return attrs


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)
    confirm_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({"confirm_password": "Passwords do not match."})
        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError(
                {"new_password": "New password must be different from your current password."}
            )
        validate_password(attrs["new_password"], user=self.context["request"].user)
        return attrs
