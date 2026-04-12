from __future__ import annotations

from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.db import close_old_connections
from django.http.cookie import parse_cookie

from accounts.models import is_user_approved
from flytest_django.authentication import CookieJWTAuthentication


class WebSocketJWTAuthMiddleware:
    """
    Authenticate websocket connections using:
    1. token/access_token query parameter
    2. Authorization header
    3. HttpOnly access cookie
    """

    def __init__(self, inner):
        self.inner = inner
        self.jwt_auth = CookieJWTAuthentication()

    async def __call__(self, scope, receive, send):
        scope = dict(scope)
        scope["user"] = await self._resolve_user(scope)
        return await self.inner(scope, receive, send)

    @database_sync_to_async
    def _resolve_user(self, scope):
        close_old_connections()
        token = self._extract_token(scope)
        if not token:
            return AnonymousUser()

        try:
            validated_token = self.jwt_auth.get_validated_token(token)
            user = self.jwt_auth.get_user(validated_token)
            self.jwt_auth._validate_password_change(user, validated_token)

            if not user.is_staff and not is_user_approved(user):
                return AnonymousUser()

            return user
        except Exception:
            return AnonymousUser()
        finally:
            close_old_connections()

    def _extract_token(self, scope) -> str | None:
        query_params = parse_qs(scope.get("query_string", b"").decode("utf-8"))
        for key in ("token", "access_token"):
            values = query_params.get(key)
            if values and values[0].strip():
                return values[0].strip()

        headers = {key.lower(): value for key, value in scope.get("headers", [])}

        auth_header = headers.get(b"authorization")
        if auth_header:
            try:
                decoded = auth_header.decode("utf-8")
            except UnicodeDecodeError:
                decoded = ""
            if decoded.startswith("Bearer "):
                return decoded.removeprefix("Bearer ").strip()

        cookie_header = headers.get(b"cookie")
        if cookie_header:
            try:
                cookies = parse_cookie(cookie_header.decode("utf-8"))
            except UnicodeDecodeError:
                cookies = {}
            raw_token = cookies.get(settings.JWT_ACCESS_COOKIE_NAME)
            if raw_token:
                return raw_token

        return None
