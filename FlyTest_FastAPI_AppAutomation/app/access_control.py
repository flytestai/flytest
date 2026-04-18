from __future__ import annotations

import json
import os
from contextvars import ContextVar, Token
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

from fastapi import HTTPException, Request

from .security import auth_disabled


_request_auth_var: ContextVar[dict[str, Any] | None] = ContextVar("app_automation_request_auth", default=None)
_request_token_var: ContextVar[str] = ContextVar("app_automation_request_token", default="")
_request_permissions_var: ContextVar[set[str] | None] = ContextVar(
    "app_automation_request_permissions",
    default=None,
)
_request_projects_var: ContextVar[list[int] | None] = ContextVar(
    "app_automation_request_projects",
    default=None,
)


def bind_request_context(auth_payload: dict[str, Any], access_token: str) -> dict[str, Token[Any]]:
    return {
        "auth": _request_auth_var.set(auth_payload),
        "token": _request_token_var.set(access_token or ""),
        "permissions": _request_permissions_var.set(None),
        "projects": _request_projects_var.set(None),
    }


def reset_request_context(tokens: dict[str, Token[Any]] | None) -> None:
    if not tokens:
        return
    _request_auth_var.reset(tokens["auth"])
    _request_token_var.reset(tokens["token"])
    _request_permissions_var.reset(tokens["permissions"])
    _request_projects_var.reset(tokens["projects"])


def has_request_context() -> bool:
    return _request_auth_var.get() is not None


def get_current_auth_payload() -> dict[str, Any]:
    return _request_auth_var.get() or {}


def _get_current_access_token() -> str:
    return (_request_token_var.get() or "").strip()


def _extract_error_message(payload: Any) -> str:
    if isinstance(payload, dict):
        for key in ("message", "detail", "error"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    if isinstance(payload, str) and payload.strip():
        return payload.strip()
    return ""


def _decode_json_response(raw: bytes) -> Any:
    if not raw:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def _join_root_and_path(root: str, path: str) -> str:
    normalized_root = root.rstrip("/")
    normalized_path = path if path.startswith("/") else f"/{path}"
    if normalized_root.endswith("/api") and normalized_path.startswith("/api/"):
        return normalized_root + normalized_path[4:]
    return normalized_root + normalized_path


def _iter_django_roots() -> list[str]:
    configured = [
        os.environ.get("APP_AUTOMATION_DJANGO_BASE_URL", ""),
        os.environ.get("FLYTEST_BACKEND_URL", ""),
        os.environ.get("DJANGO_BASE_URL", ""),
    ]
    roots: list[str] = []
    seen: set[str] = set()
    for item in configured:
        root = (item or "").strip().rstrip("/")
        if not root or root in seen:
            continue
        seen.add(root)
        roots.append(root)
    return roots


def remote_access_control_enabled() -> bool:
    return bool(_iter_django_roots())


def _fetch_django_json(path: str) -> Any:
    access_token = _get_current_access_token()
    if not access_token:
        raise HTTPException(status_code=401, detail="缺少访问令牌")

    last_error: str = ""
    for root in _iter_django_roots():
        request = urllib_request.Request(
            _join_root_and_path(root, path),
            headers={
                "Accept": "application/json",
                "Authorization": f"Bearer {access_token}",
            },
            method="GET",
        )
        try:
            with urllib_request.urlopen(request, timeout=5) as response:
                return _decode_json_response(response.read())
        except urllib_error.HTTPError as exc:
            payload = _decode_json_response(exc.read())
            if exc.code in {401, 403}:
                detail = _extract_error_message(payload) or "无权访问 Django 权限服务"
                raise HTTPException(status_code=exc.code, detail=detail) from exc
            last_error = _extract_error_message(payload) or f"HTTP {exc.code}"
        except OSError as exc:
            last_error = str(exc)

    detail = "无法连接 Django 权限服务"
    if last_error:
        detail = f"{detail}: {last_error}"
    raise HTTPException(status_code=503, detail=detail)


def _extract_response_data(payload: Any) -> Any:
    if isinstance(payload, dict) and "data" in payload:
        return payload.get("data")
    return payload


def _get_current_user_id() -> int | None:
    payload = get_current_auth_payload()
    for key in ("user_id", "id", "sub"):
        value = payload.get(key)
        if isinstance(value, int):
            return value
        if isinstance(value, str) and value.isdigit():
            return int(value)
    return None


def _load_user_permissions() -> set[str]:
    cached = _request_permissions_var.get()
    if cached is not None:
        return cached

    if not remote_access_control_enabled():
        permissions: set[str] = set()
        _request_permissions_var.set(permissions)
        return permissions

    user_id = _get_current_user_id()
    if user_id is None:
        raise HTTPException(status_code=403, detail="当前认证上下文缺少用户标识")

    payload = _fetch_django_json(f"/api/accounts/users/{user_id}/permissions/")
    data = _extract_response_data(payload)
    permissions: set[str] = set()
    if isinstance(data, list):
        for item in data:
            if not isinstance(item, dict):
                continue
            codename = str(item.get("codename") or "").strip()
            content_type = item.get("content_type")
            app_label = ""
            if isinstance(content_type, dict):
                app_label = str(content_type.get("app_label") or "").strip()
            if codename:
                permissions.add(codename)
            if app_label and codename:
                permissions.add(f"{app_label}.{codename}")

    _request_permissions_var.set(permissions)
    return permissions


def _load_accessible_project_ids() -> list[int]:
    cached = _request_projects_var.get()
    if cached is not None:
        return cached

    if not remote_access_control_enabled():
        project_ids: list[int] = []
        _request_projects_var.set(project_ids)
        return project_ids

    payload = _fetch_django_json("/api/projects/")
    data = _extract_response_data(payload)
    if isinstance(data, dict) and "results" in data:
        data = data.get("results")

    project_ids: list[int] = []
    if isinstance(data, list):
        for item in data:
            if not isinstance(item, dict):
                continue
            project_id = item.get("id")
            if isinstance(project_id, int):
                project_ids.append(project_id)
            elif isinstance(project_id, str) and project_id.isdigit():
                project_ids.append(int(project_id))

    deduped = sorted(set(project_ids))
    _request_projects_var.set(deduped)
    return deduped


def get_required_permission_for_path(path: str) -> str | None:
    normalized = (path or "").rstrip("/") or "/"
    if normalized.startswith("/dashboard/"):
        return "app_automation.view_appautomationoverview"
    if normalized.startswith("/devices/"):
        return "app_automation.view_appautomationdevice"
    if normalized.startswith("/packages/"):
        return "app_automation.view_appautomationpackage"
    if normalized.startswith("/elements/"):
        return "app_automation.view_appautomationelement"
    if normalized.startswith("/ai/"):
        return "app_automation.view_appautomationscenebuilder"
    if normalized.startswith("/components/"):
        return "app_automation.view_appautomationscenebuilder"
    if normalized.startswith("/custom-components/"):
        return "app_automation.view_appautomationscenebuilder"
    if normalized.startswith("/component-packages/"):
        return "app_automation.view_appautomationscenebuilder"
    if normalized.startswith("/test-cases/"):
        return "app_automation.view_appautomationtestcase"
    if normalized.startswith("/test-suites/"):
        return "app_automation.view_appautomationsuite"
    if normalized.startswith("/executions/"):
        if "/report" in normalized:
            return "app_automation.view_appautomationreport"
        return "app_automation.view_appautomationexecution"
    if normalized.startswith("/scheduled-tasks/"):
        return "app_automation.view_appautomationscheduledtask"
    if normalized.startswith("/notification-logs/"):
        return "app_automation.view_appautomationnotification"
    if normalized.startswith("/settings/"):
        return "app_automation.view_appautomationsettings"
    return None


def enforce_request_module_permission(request: Request) -> None:
    if auth_disabled() or not has_request_context() or not remote_access_control_enabled():
        return

    required_permission = get_required_permission_for_path(request.url.path)
    if not required_permission:
        return

    permissions = _load_user_permissions()
    if required_permission not in permissions:
        raise HTTPException(status_code=403, detail="当前用户无权访问该 APP 自动化模块")


def ensure_project_access(project_id: int) -> None:
    if auth_disabled() or not has_request_context() or not remote_access_control_enabled():
        return

    if project_id not in _load_accessible_project_ids():
        raise HTTPException(status_code=403, detail="当前用户无权访问该项目的 APP 自动化数据")


def ensure_row_project_access(row: dict[str, Any] | None, key: str = "project_id") -> None:
    if not row:
        return
    project_id = row.get(key)
    if isinstance(project_id, int):
        ensure_project_access(project_id)
    elif isinstance(project_id, str) and project_id.isdigit():
        ensure_project_access(int(project_id))


def resolve_scoped_project_ids(requested_project_id: int | None) -> list[int] | None:
    if requested_project_id is not None:
        ensure_project_access(requested_project_id)
        return [requested_project_id]

    if auth_disabled() or not has_request_context() or not remote_access_control_enabled():
        return None

    return _load_accessible_project_ids()


def apply_project_scope_filter(
    query: str,
    params: list[Any],
    requested_project_id: int | None,
    *,
    column: str = "project_id",
) -> tuple[str, list[Any]]:
    scoped_project_ids = resolve_scoped_project_ids(requested_project_id)
    if scoped_project_ids is None:
        if requested_project_id is not None:
            params.append(requested_project_id)
            return f"{query} AND {column} = ?", params
        return query, params

    if not scoped_project_ids:
        return f"{query} AND 1 = 0", params

    if requested_project_id is not None:
        params.append(scoped_project_ids[0])
        return f"{query} AND {column} = ?", params

    placeholders = ", ".join("?" for _ in scoped_project_ids)
    params.extend(scoped_project_ids)
    return f"{query} AND {column} IN ({placeholders})", params
