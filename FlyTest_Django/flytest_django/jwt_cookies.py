from __future__ import annotations

from django.conf import settings
from datetime import timedelta


def _cookie_common_kwargs(*, httponly: bool = True) -> dict[str, object]:
    kwargs: dict[str, object] = {
        "httponly": httponly,
        "secure": settings.JWT_COOKIE_SECURE,
        "samesite": settings.JWT_COOKIE_SAMESITE,
        "path": settings.JWT_COOKIE_PATH,
    }
    if settings.JWT_COOKIE_DOMAIN:
        kwargs["domain"] = settings.JWT_COOKIE_DOMAIN
    return kwargs


def _seconds(value: timedelta | int | None, fallback_seconds: int) -> int:
    if value is None:
        return fallback_seconds
    if isinstance(value, timedelta):
        return int(value.total_seconds())
    return int(value)


def set_auth_cookies(
    response,
    *,
    access_token: str,
    refresh_token: str | None = None,
    access_max_age: timedelta | int | None = None,
    refresh_max_age: timedelta | int | None = None,
) -> None:
    default_access_seconds = int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())
    default_refresh_seconds = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())

    response.set_cookie(
        settings.JWT_ACCESS_COOKIE_NAME,
        access_token,
        max_age=_seconds(access_max_age, default_access_seconds),
        **_cookie_common_kwargs(),
    )
    if refresh_token:
        response.set_cookie(
            settings.JWT_REFRESH_COOKIE_NAME,
            refresh_token,
            max_age=_seconds(refresh_max_age, default_refresh_seconds),
            **_cookie_common_kwargs(),
        )


def clear_auth_cookies(response) -> None:
    kwargs = _cookie_common_kwargs()
    response.delete_cookie(settings.JWT_ACCESS_COOKIE_NAME, path=kwargs["path"], domain=kwargs.get("domain"), samesite=kwargs["samesite"])
    response.delete_cookie(settings.JWT_REFRESH_COOKIE_NAME, path=kwargs["path"], domain=kwargs.get("domain"), samesite=kwargs["samesite"])
