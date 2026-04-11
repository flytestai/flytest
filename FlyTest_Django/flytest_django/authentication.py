from __future__ import annotations

from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication
from accounts.models import get_user_profile


class CookieJWTAuthentication(JWTAuthentication):
    """
    Support JWT auth via Authorization header first, then HttpOnly access cookie.
    """

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is not None:
                validated_token = self.get_validated_token(raw_token)
                user = self.get_user(validated_token)
                self._validate_password_change(user, validated_token)
                return user, validated_token

        raw_token = request.COOKIES.get(settings.JWT_ACCESS_COOKIE_NAME)
        if not raw_token:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        self._validate_password_change(user, validated_token)
        return user, validated_token

    def _validate_password_change(self, user, validated_token):
        profile = get_user_profile(user)
        password_changed_at = getattr(profile, "password_changed_at", None)
        token_issued_at = validated_token.get("iat")

        if (
            password_changed_at
            and token_issued_at
            and token_issued_at < int(password_changed_at.timestamp())
        ):
            raise AuthenticationFailed("登录状态已失效，请重新登录。")
