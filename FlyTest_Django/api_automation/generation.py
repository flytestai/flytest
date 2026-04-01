from __future__ import annotations

from typing import Any

from .document_import import ParsedRequestData


def _legacy_body_from_structured_override(request_override_spec: dict[str, Any] | None) -> tuple[str, Any]:
    override = request_override_spec or {}
    body_mode = str(override.get("body_mode") or "none").lower()
    if body_mode == "json":
        return "json", override.get("body_json") or {}
    if body_mode in {"form", "urlencoded"}:
        return "form", {
            item["name"]: item.get("value", "")
            for item in (override.get("form_fields") or [])
            if isinstance(item, dict) and item.get("name") and item.get("enabled", True)
        }
    if body_mode == "multipart":
        return "form", {
            item["name"]: item.get("value", "")
            for item in (override.get("multipart_parts") or [])
            if isinstance(item, dict) and item.get("name") and item.get("enabled", True)
        }
    if body_mode == "graphql":
        return "json", {
            "query": override.get("graphql_query") or "",
            "operationName": override.get("graphql_operation_name") or "",
            "variables": override.get("graphql_variables") or {},
        }
    if body_mode == "xml":
        return "raw", override.get("xml_text") or ""
    if body_mode == "binary":
        return "raw", override.get("binary_base64") or ""
    if body_mode == "raw":
        return "raw", override.get("raw_text") or ""
    return "none", {}


def build_request_script(
    *,
    api_request=None,
    method: str = "GET",
    url: str = "",
    headers: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
    body_type: str = "none",
    body: Any = None,
    timeout_ms: int = 30000,
    assertions: list[dict[str, Any]] | None = None,
    extractors: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    if api_request is not None:
        from .specs import serialize_assertion_specs, serialize_extractor_specs, serialize_request_spec

        request_spec = serialize_request_spec(api_request)
        assertions = serialize_assertion_specs(api_request)
        extractors = serialize_extractor_specs(api_request)
        method = request_spec["method"]
        url = request_spec["url"]
        headers = {item["name"]: item.get("value", "") for item in request_spec["headers"] if item.get("enabled", True)}
        params = {item["name"]: item.get("value", "") for item in request_spec["query"] if item.get("enabled", True)}
        body_type = request_spec["body_mode"]
        if body_type == "json":
            body = request_spec.get("body_json") or {}
        elif body_type in {"form", "urlencoded"}:
            body = {item["name"]: item.get("value", "") for item in request_spec["form_fields"] if item.get("enabled", True)}
        elif body_type == "multipart":
            body = {item["name"]: item.get("value", "") for item in request_spec["multipart_parts"] if item.get("enabled", True)}
        elif body_type == "xml":
            body = request_spec.get("xml_text") or ""
        elif body_type == "graphql":
            body = {
                "query": request_spec.get("graphql_query") or "",
                "operationName": request_spec.get("graphql_operation_name") or "",
                "variables": request_spec.get("graphql_variables") or {},
            }
        elif body_type == "binary":
            body = request_spec.get("binary_base64") or ""
        else:
            body = request_spec.get("raw_text") or ""
        timeout_ms = int(request_spec.get("timeout_ms") or timeout_ms)

    return {
        "version": "2.0",
        "request": {
            "method": method,
            "url": url,
            "headers": headers or {},
            "params": params or {},
            "body_type": body_type,
            "body": body if body is not None else {},
            "timeout_ms": timeout_ms,
        },
        "assertions": assertions or [],
        "extractors": extractors or [],
        "stages": [
            {
                "name": "prepare",
                "type": "prepare",
                "enabled": True,
            },
            {
                "name": "auth",
                "type": "auth",
                "enabled": True,
            },
            {
                "name": "execute",
                "type": "request",
                "enabled": True,
            },
            {
                "name": "extract",
                "type": "extractors",
                "enabled": True,
            },
            {
                "name": "assert",
                "type": "assertions",
                "enabled": True,
            },
            {
                "name": "teardown",
                "type": "teardown",
                "enabled": True,
            },
        ],
    }


def build_parameterized_test_case_script(
    *,
    request_id: int,
    method: str,
    url: str,
    headers: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
    body_type: str | None = None,
    body: Any = None,
    timeout_ms: int = 30000,
    assertions: list[dict[str, Any]] | None = None,
    extractors: list[dict[str, Any]] | None = None,
    request_override_spec: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if request_override_spec:
        if headers is None:
            headers = {
                item["name"]: item.get("value", "")
                for item in (request_override_spec.get("headers") or [])
                if isinstance(item, dict) and item.get("name") and item.get("enabled", True)
            }
        if params is None:
            params = {
                item["name"]: item.get("value", "")
                for item in (request_override_spec.get("query") or [])
                if isinstance(item, dict) and item.get("name") and item.get("enabled", True)
            }
        if body_type is None and body is None:
            body_type, body = _legacy_body_from_structured_override(request_override_spec)
        timeout_ms = int(request_override_spec.get("timeout_ms") or timeout_ms)

    return {
        "version": "2.0",
        "mode": "parameterized",
        "request_ref": {
            "id": request_id,
            "method": method,
            "url": url,
        },
        "request_overrides": {
            "headers": headers or {},
            "params": params or {},
            "body_type": body_type or "none",
            "body": body if body is not None else {},
            "timeout_ms": timeout_ms,
        },
        "assertions": assertions or [],
        "extractors": extractors or [],
        "request_override_spec": request_override_spec or {},
        "stages": [
            {
                "name": "prepare",
                "type": "prepare",
                "enabled": True,
            },
            {
                "name": "auth",
                "type": "auth",
                "enabled": True,
            },
            {
                "name": "bind_request",
                "type": "request_ref",
                "enabled": True,
            },
            {
                "name": "override_request",
                "type": "request_overrides",
                "enabled": True,
            },
            {
                "name": "execute",
                "type": "request",
                "enabled": True,
            },
            {
                "name": "extract",
                "type": "extractors",
                "enabled": True,
            },
            {
                "name": "assert",
                "type": "assertions",
                "enabled": True,
            },
            {
                "name": "teardown",
                "type": "teardown",
                "enabled": True,
            },
        ],
    }


def generate_test_case_name(request_name: str, method: str) -> str:
    action_map = {
        "GET": "读取校验",
        "POST": "创建校验",
        "PUT": "更新校验",
        "PATCH": "修改校验",
        "DELETE": "删除校验",
        "HEAD": "响应头校验",
        "OPTIONS": "能力探测校验",
    }
    suffix = action_map.get(method.upper(), "接口校验")
    return f"{request_name} - {suffix}"


def generate_test_case_description(request_name: str, url: str, method: str) -> str:
    return (
        f"根据接口文档自动生成的测试用例，用于验证 {request_name}"
        f"（{method} {url}）的基础可用性与响应状态。"
    )


def generate_script_and_test_case(parsed_request: ParsedRequestData, request_id: int) -> tuple[dict[str, Any], dict[str, Any]]:
    assertions = parsed_request.assertions or [{"type": "status_code", "expected": 200}]
    request_script = build_request_script(
        method=parsed_request.method,
        url=parsed_request.url,
        headers=parsed_request.headers,
        params=parsed_request.params,
        body_type=parsed_request.body_type,
        body=parsed_request.body,
        assertions=assertions,
    )

    test_case_script = build_parameterized_test_case_script(
        request_id=request_id,
        method=parsed_request.method,
        url=parsed_request.url,
        headers=parsed_request.headers,
        params=parsed_request.params,
        body_type=parsed_request.body_type,
        body=parsed_request.body,
        assertions=assertions,
    )

    test_case = {
        "name": generate_test_case_name(parsed_request.name, parsed_request.method),
        "description": generate_test_case_description(parsed_request.name, parsed_request.url, parsed_request.method),
        "status": "ready",
        "tags": list(
            {
                "auto-generated",
                parsed_request.method.lower(),
                (parsed_request.collection_name or "default").lower(),
            }
        ),
        "assertions": assertions,
        "script": test_case_script,
    }
    return request_script, test_case
