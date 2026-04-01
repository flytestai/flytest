from __future__ import annotations

from dataclasses import dataclass
import json
import logging
from string import Template
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from langgraph_integration.models import LLMConfig
from prompts.models import UserPrompt

from .ai_parser import create_llm_instance, extract_json_from_response, safe_llm_invoke
from .document_import import HTTP_METHODS
from .generation import build_parameterized_test_case_script
from .models import ApiRequest, ApiTestCase
from .specs import (
    apply_test_case_assertions_and_extractors,
    apply_test_case_override_payload,
    serialize_assertion_specs,
    serialize_extractor_specs,
    serialize_request_spec,
    serialize_test_case_override,
)

logger = logging.getLogger(__name__)

SUPPORTED_BODY_TYPES = {"none", "json", "form", "urlencoded", "multipart", "raw", "xml", "graphql", "binary"}
SUPPORTED_CASE_STATUSES = {"draft", "ready", "disabled"}
SUPPORTED_ASSERTIONS = {
    "status_code",
    "status_range",
    "body_contains",
    "body_not_contains",
    "json_path",
    "header",
    "cookie",
    "regex",
    "exists",
    "not_exists",
    "array_length",
    "response_time",
    "json_schema",
    "openapi_contract",
}
SUPPORTED_EXTRACTORS = {
    "json_path",
    "header",
    "cookie",
    "regex",
    "status_code",
    "response_time",
}

DEFAULT_CASE_PROMPT = """你是 FlyTest 的资深 API 自动化测试设计专家。
请围绕给定接口生成结构化测试用例，要求如下：

1. 每个测试用例必须严格绑定当前接口，不能跨接口。
2. 优先覆盖：基础成功场景、核心业务校验、关键边界场景、常见异常场景。
3. 如果已有测试用例，请避免和现有名称、意图完全重复；在追加生成模式下尤其如此。
4. 断言优先使用结构化规格，可使用：
   - status_code / status_range
   - body_contains / body_not_contains
   - json_path / exists / not_exists / array_length
   - header / cookie / regex
   - response_time / json_schema / openapi_contract
5. 如需依赖响应上下文，请使用 extractors 提取变量，可使用：
   - json_path / header / cookie / regex / status_code / response_time
6. request_overrides 只返回相对当前接口需要覆盖的字段，可包含：
   - method / url / timeout_ms
   - headers / query / cookies
   - body_mode / body_json / raw_text / xml_text / graphql_query / graphql_operation_name / graphql_variables / binary_base64
   - form_fields / multipart_parts / files
   - auth / transport
7. 结果必须只返回 JSON，不要输出 Markdown，不要解释。

输出 JSON 结构如下：
{
  "summary": "一句话总结本次生成策略",
  "cases": [
    {
      "name": "测试用例名称",
      "description": "测试目标说明",
      "status": "ready",
      "tags": ["ai-generated", "positive"],
      "assertions": [
        {"assertion_type": "status_code", "expected_number": 200},
        {"assertion_type": "json_path", "selector": "code", "operator": "equals", "expected_number": 0}
      ],
      "extractors": [
        {"source": "json_path", "selector": "data.id", "variable_name": "created_id"}
      ],
      "request_overrides": {
        "headers": [],
        "query": [],
        "cookies": [],
        "body_mode": "json",
        "body_json": {},
        "timeout_ms": 30000
      }
    }
  ]
}

当前模式: ${mode}
期望生成数量: ${count}
接口信息:
${request_json}

已有测试用例:
${existing_cases_json}
"""


@dataclass
class GeneratedCaseDraft:
    name: str
    description: str
    status: str
    tags: list[str]
    assertions: list[dict[str, Any]]
    extractors: list[dict[str, Any]]
    request_overrides: dict[str, Any]


@dataclass
class AITestCaseGenerationResult:
    used_ai: bool
    note: str
    cases: list[GeneratedCaseDraft]
    prompt_name: str | None = None
    prompt_source: str | None = None
    model_name: str | None = None


def _format_prompt(template: str, **kwargs) -> str:
    result = template
    for key, value in kwargs.items():
        result = result.replace(f"{{{key}}}", str(value))
    try:
        result = Template(result).safe_substitute(**kwargs)
    except Exception:  # noqa: BLE001
        pass
    return result


def _get_generation_prompt(user) -> tuple[str, str, str]:
    user_prompt = (
        UserPrompt.objects.filter(user=user, is_active=True, name__icontains="API自动化用例生成")
        .order_by("-updated_at")
        .first()
    )
    if user_prompt:
        return user_prompt.content, "user_prompt", user_prompt.name
    return DEFAULT_CASE_PROMPT, "builtin_fallback", "API自动化用例生成"


def _serialize_request(api_request: ApiRequest) -> str:
    payload = {
        "id": api_request.id,
        "name": api_request.name,
        "description": api_request.description or "",
        "request_spec": serialize_request_spec(api_request),
        "assertion_specs": serialize_assertion_specs(api_request),
        "extractor_specs": serialize_extractor_specs(api_request),
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def _serialize_existing_cases(existing_cases: list[ApiTestCase]) -> str:
    payload = [
        {
            "id": case.id,
            "name": case.name,
            "description": case.description or "",
            "status": case.status,
            "tags": case.tags or [],
            "assertion_specs": serialize_assertion_specs(case),
            "extractor_specs": serialize_extractor_specs(case),
            "request_override_spec": serialize_test_case_override(case),
        }
        for case in existing_cases
    ]
    return json.dumps(payload, ensure_ascii=False, indent=2)


def _normalize_assertions(assertions: Any, fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    if isinstance(assertions, list):
        for item in assertions:
            if not isinstance(item, dict):
                continue
            assertion_type = str(item.get("assertion_type") or item.get("type") or "").strip()
            if assertion_type not in SUPPORTED_ASSERTIONS:
                continue
            normalized_item: dict[str, Any] = {
                "assertion_type": assertion_type,
                "target": item.get("target") or ("json" if assertion_type == "json_path" else "body"),
                "selector": item.get("selector") or item.get("path") or "",
                "operator": item.get("operator") or "equals",
                "expected_text": item.get("expected_text") or "",
                "expected_number": item.get("expected_number"),
                "expected_json": item.get("expected_json") or {},
                "min_value": item.get("min_value"),
                "max_value": item.get("max_value"),
                "schema_text": item.get("schema_text") or "",
            }
            if item.get("expected") not in (None, "") and normalized_item["expected_number"] in (None, ""):
                if isinstance(item.get("expected"), (int, float)):
                    normalized_item["expected_number"] = item.get("expected")
                elif isinstance(item.get("expected"), (dict, list, bool)):
                    normalized_item["expected_json"] = item.get("expected")
                else:
                    normalized_item["expected_text"] = str(item.get("expected"))
            normalized.append(normalized_item)
    return normalized or fallback or [{"assertion_type": "status_code", "expected_number": 200}]


def _normalize_extractors(extractors: Any, fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    if isinstance(extractors, list):
        for item in extractors:
            if not isinstance(item, dict):
                continue
            source = str(item.get("source") or item.get("type") or "").strip()
            variable_name = str(item.get("variable_name") or item.get("name") or "").strip()
            if source not in SUPPORTED_EXTRACTORS or not variable_name:
                continue
            normalized.append(
                {
                    "source": source,
                    "selector": str(item.get("selector") or item.get("path") or ""),
                    "variable_name": variable_name,
                    "default_value": str(item.get("default_value") or ""),
                    "required": bool(item.get("required", False)),
                    "enabled": bool(item.get("enabled", True)),
                    "order": int(item.get("order", len(normalized))),
                }
            )
    return normalized or fallback or []


def _normalize_named_items(items: Any) -> list[dict[str, Any]]:
    if isinstance(items, dict):
        return [
            {"name": str(key), "value": value, "enabled": True, "order": index}
            for index, (key, value) in enumerate(items.items())
        ]
    if isinstance(items, list):
        normalized = []
        for index, item in enumerate(items):
            if not isinstance(item, dict) or not item.get("name"):
                continue
            normalized.append(
                {
                    "name": str(item.get("name")),
                    "value": item.get("value", ""),
                    "enabled": bool(item.get("enabled", True)),
                    "order": int(item.get("order", index)),
                }
            )
        return normalized
    return []


def _normalize_request_overrides(api_request: ApiRequest, overrides: Any) -> dict[str, Any]:
    if not isinstance(overrides, dict):
        overrides = {}

    base_request_spec = serialize_request_spec(api_request)
    body_mode = str(overrides.get("body_mode") or overrides.get("body_type") or base_request_spec["body_mode"]).lower()
    if body_mode not in SUPPORTED_BODY_TYPES:
        body_mode = base_request_spec["body_mode"]

    normalized = {
        "method": str(overrides.get("method") or ""),
        "url": str(overrides.get("url") or ""),
        "headers": _normalize_named_items(overrides.get("headers")),
        "query": _normalize_named_items(overrides.get("query") or overrides.get("params")),
        "cookies": _normalize_named_items(overrides.get("cookies")),
        "form_fields": _normalize_named_items(overrides.get("form_fields")),
        "multipart_parts": _normalize_named_items(overrides.get("multipart_parts")),
        "files": overrides.get("files") if isinstance(overrides.get("files"), list) else [],
        "body_mode": body_mode,
        "body_json": overrides.get("body_json") if isinstance(overrides.get("body_json"), (dict, list)) else {},
        "raw_text": str(overrides.get("raw_text") or ""),
        "xml_text": str(overrides.get("xml_text") or ""),
        "binary_base64": str(overrides.get("binary_base64") or ""),
        "graphql_query": str(overrides.get("graphql_query") or ""),
        "graphql_operation_name": str(overrides.get("graphql_operation_name") or ""),
        "graphql_variables": overrides.get("graphql_variables") if isinstance(overrides.get("graphql_variables"), dict) else {},
        "timeout_ms": int(overrides.get("timeout_ms") or base_request_spec["timeout_ms"] or api_request.timeout_ms or 30000),
        "auth": overrides.get("auth") if isinstance(overrides.get("auth"), dict) else {},
        "transport": overrides.get("transport") if isinstance(overrides.get("transport"), dict) else {},
    }
    if overrides.get("body") not in (None, ""):
        if body_mode == "json" and isinstance(overrides.get("body"), (dict, list)):
            normalized["body_json"] = overrides.get("body")
        elif body_mode in {"raw", "xml", "binary"}:
            normalized["raw_text"] = str(overrides.get("body"))
    return normalized


def _canonicalize_assertion(assertion: dict[str, Any]) -> dict[str, Any]:
    return {
        "assertion_type": str(assertion.get("assertion_type") or assertion.get("type") or ""),
        "target": str(assertion.get("target") or ""),
        "selector": str(assertion.get("selector") or assertion.get("path") or ""),
        "operator": str(assertion.get("operator") or "equals"),
        "expected_text": str(assertion.get("expected_text") or ""),
        "expected_number": assertion.get("expected_number"),
        "expected_json": assertion.get("expected_json") or {},
        "min_value": assertion.get("min_value"),
        "max_value": assertion.get("max_value"),
        "schema_text": str(assertion.get("schema_text") or ""),
    }


def _canonicalize_named_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        normalized.append(
            {
                "name": name,
                "value": item.get("value", ""),
                "enabled": bool(item.get("enabled", True)),
            }
        )
    return sorted(normalized, key=lambda entry: (entry["name"], str(entry["value"]), entry["enabled"]))


def _canonicalize_files(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        field_name = str(item.get("field_name") or "").strip()
        if not field_name:
            continue
        normalized.append(
            {
                "field_name": field_name,
                "source_type": str(item.get("source_type") or "path"),
                "file_path": str(item.get("file_path") or ""),
                "file_name": str(item.get("file_name") or ""),
                "content_type": str(item.get("content_type") or ""),
                "base64_content": str(item.get("base64_content") or ""),
                "enabled": bool(item.get("enabled", True)),
            }
        )
    return sorted(
        normalized,
        key=lambda entry: (
            entry["field_name"],
            entry["source_type"],
            entry["file_name"],
            entry["file_path"],
            entry["content_type"],
            entry["enabled"],
        ),
    )


def _canonicalize_request_overrides(overrides: dict[str, Any]) -> dict[str, Any]:
    return {
        "method": str(overrides.get("method") or "").upper(),
        "url": str(overrides.get("url") or ""),
        "headers": _canonicalize_named_items(overrides.get("headers") or []),
        "query": _canonicalize_named_items(overrides.get("query") or []),
        "cookies": _canonicalize_named_items(overrides.get("cookies") or []),
        "form_fields": _canonicalize_named_items(overrides.get("form_fields") or []),
        "multipart_parts": _canonicalize_named_items(overrides.get("multipart_parts") or []),
        "files": _canonicalize_files(overrides.get("files") or []),
        "body_mode": str(overrides.get("body_mode") or "none").lower(),
        "body_json": overrides.get("body_json") if isinstance(overrides.get("body_json"), (dict, list)) else {},
        "raw_text": str(overrides.get("raw_text") or ""),
        "xml_text": str(overrides.get("xml_text") or ""),
        "binary_base64": str(overrides.get("binary_base64") or ""),
        "graphql_query": str(overrides.get("graphql_query") or ""),
        "graphql_operation_name": str(overrides.get("graphql_operation_name") or ""),
        "graphql_variables": overrides.get("graphql_variables") if isinstance(overrides.get("graphql_variables"), dict) else {},
        "timeout_ms": int(overrides.get("timeout_ms") or 0),
        "auth": overrides.get("auth") if isinstance(overrides.get("auth"), dict) else {},
        "transport": overrides.get("transport") if isinstance(overrides.get("transport"), dict) else {},
    }


def _semantic_case_fingerprint(assertions: list[dict[str, Any]], overrides: dict[str, Any]) -> str:
    signature = {
        "assertions": sorted(
            [_canonicalize_assertion(item) for item in assertions or [] if isinstance(item, dict)],
            key=lambda item: (
                item["assertion_type"],
                item["target"],
                item["selector"],
                item["operator"],
                json.dumps(item["expected_json"], ensure_ascii=False, sort_keys=True),
                item["expected_text"],
                str(item["expected_number"]),
                str(item["min_value"]),
                str(item["max_value"]),
                item["schema_text"],
            ),
        ),
        "request_overrides": _canonicalize_request_overrides(overrides or {}),
    }
    return json.dumps(signature, ensure_ascii=False, sort_keys=True)


def _normalize_case_draft(
    api_request: ApiRequest,
    item: dict[str, Any],
    index: int,
    existing_names: set[str],
    existing_fingerprints: set[str],
) -> GeneratedCaseDraft | None:
    raw_name = str(item.get("name") or "").strip() or f"{api_request.name} - AI场景{index + 1}"
    name = raw_name[:160]
    unique_name = name
    suffix = 2
    while unique_name in existing_names:
        unique_name = f"{name[:150]}-{suffix}"
        suffix += 1
    existing_names.add(unique_name)

    raw_status = str(item.get("status") or "ready").strip().lower()
    status = raw_status if raw_status in SUPPORTED_CASE_STATUSES else "ready"
    tags = [str(tag).strip() for tag in (item.get("tags") or []) if str(tag).strip()]
    if "ai-generated" not in tags:
        tags.append("ai-generated")
    if api_request.method.lower() not in tags:
        tags.append(api_request.method.lower())

    fallback_assertions = serialize_assertion_specs(api_request) or [{"assertion_type": "status_code", "expected_number": 200}]
    assertions = _normalize_assertions(item.get("assertions"), fallback_assertions)
    extractors = _normalize_extractors(item.get("extractors"), [])
    overrides = _normalize_request_overrides(api_request, item.get("request_overrides"))
    fingerprint = _semantic_case_fingerprint(assertions, overrides)
    if fingerprint in existing_fingerprints:
        return None
    existing_fingerprints.add(fingerprint)

    return GeneratedCaseDraft(
        name=unique_name,
        description=str(item.get("description") or f"AI 生成的 {api_request.name} 测试场景")[:5000],
        status=status,
        tags=list(dict.fromkeys(tags)),
        assertions=assertions,
        extractors=extractors,
        request_overrides=overrides,
    )


def _build_fallback_cases(
    api_request: ApiRequest,
    existing_cases: list[ApiTestCase],
    *,
    count: int,
) -> list[GeneratedCaseDraft]:
    existing_names = {case.name for case in existing_cases}
    existing_fingerprints = {
        _semantic_case_fingerprint(serialize_assertion_specs(case), serialize_test_case_override(case))
        for case in existing_cases
    }
    base_assertions = serialize_assertion_specs(api_request) or [{"assertion_type": "status_code", "expected_number": 200}]

    templates = [
        {
            "name": f"{api_request.name} - 基础成功校验",
            "description": f"验证 {api_request.method} {api_request.url} 的基础可用性。",
            "tags": ["baseline", "positive"],
            "assertions": base_assertions,
            "extractors": [],
            "request_overrides": {},
        },
        {
            "name": f"{api_request.name} - 响应结构校验",
            "description": f"验证 {api_request.name} 的核心响应字段和断言配置。",
            "tags": ["response-check", "regression"],
            "assertions": base_assertions,
            "extractors": [],
            "request_overrides": {},
        },
        {
            "name": f"{api_request.name} - 回归稳定性校验",
            "description": f"用于回归验证 {api_request.name} 在当前环境下的稳定执行能力。",
            "tags": ["regression", "smoke"],
            "assertions": base_assertions,
            "extractors": [],
            "request_overrides": {},
        },
    ]

    drafts: list[GeneratedCaseDraft] = []
    for index, template in enumerate(templates[: max(1, count)]):
        draft = _normalize_case_draft(api_request, template, index, existing_names, existing_fingerprints)
        if draft:
            drafts.append(draft)
    return drafts


def generate_test_case_drafts_with_ai(
    *,
    api_request: ApiRequest,
    user,
    existing_cases: list[ApiTestCase],
    mode: str,
    count: int,
) -> AITestCaseGenerationResult:
    active_config = LLMConfig.objects.filter(is_active=True).first()
    if not active_config:
        fallback_cases = _build_fallback_cases(api_request, existing_cases, count=count)
        return AITestCaseGenerationResult(
            used_ai=False,
            note="未检测到激活的 LLM 配置，已回退到模板生成测试用例。",
            cases=fallback_cases,
            prompt_name="API自动化用例生成",
            prompt_source="builtin_fallback",
            model_name=None,
        )

    prompt_template, prompt_source, prompt_name = _get_generation_prompt(user)
    formatted_prompt = _format_prompt(
        prompt_template,
        mode=mode,
        count=count,
        request_json=_serialize_request(api_request),
        existing_cases_json=_serialize_existing_cases(existing_cases),
    )

    try:
        llm = create_llm_instance(active_config, temperature=0.2)
        response = safe_llm_invoke(
            llm,
            [
                SystemMessage(
                    content=(
                        "你是专业的 API 自动化测试设计助手。"
                        "必须只返回合法 JSON，不能输出 Markdown 或解释文本。"
                    )
                ),
                HumanMessage(content=formatted_prompt),
            ],
        )
        payload = extract_json_from_response(getattr(response, "content", ""))
        if not isinstance(payload, dict):
            raise ValueError("AI 返回结果不是 JSON 对象")

        raw_cases = payload.get("cases") or []
        if not isinstance(raw_cases, list) or not raw_cases:
            raise ValueError("AI 未返回可用的测试用例列表")

        existing_names = {case.name for case in existing_cases}
        existing_fingerprints = {
            _semantic_case_fingerprint(serialize_assertion_specs(case), serialize_test_case_override(case))
            for case in existing_cases
        }
        drafts: list[GeneratedCaseDraft] = []
        for index, item in enumerate(raw_cases[: max(1, count)]):
            if not isinstance(item, dict):
                continue
            draft = _normalize_case_draft(api_request, item, index, existing_names, existing_fingerprints)
            if draft:
                drafts.append(draft)

        if not drafts:
            raise ValueError("AI 生成结果无法转换为可落库的测试用例")

        summary = str(payload.get("summary") or "").strip()
        return AITestCaseGenerationResult(
            used_ai=True,
            note=summary or f"已通过 AI 为接口 {api_request.name} 生成测试用例。",
            cases=drafts,
            prompt_name=prompt_name,
            prompt_source=prompt_source,
            model_name=active_config.name,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning("API test case AI generation failed: %s", exc, exc_info=True)
        fallback_cases = _build_fallback_cases(api_request, existing_cases, count=count)
        return AITestCaseGenerationResult(
            used_ai=False,
            note=f"AI 生成测试用例失败，已回退到模板生成。失败原因: {exc}",
            cases=fallback_cases,
            prompt_name=prompt_name,
            prompt_source=prompt_source,
            model_name=active_config.name,
        )


def create_test_cases_from_drafts(
    *,
    api_request: ApiRequest,
    drafts: list[GeneratedCaseDraft],
    creator,
) -> list[ApiTestCase]:
    created_cases: list[ApiTestCase] = []
    for draft in drafts:
        script = build_parameterized_test_case_script(
            request_id=api_request.id,
            method=api_request.method,
            url=api_request.url,
            headers={},
            params={},
            body_type=api_request.body_type,
            body=api_request.body,
            timeout_ms=int(draft.request_overrides.get("timeout_ms") or api_request.timeout_ms or 30000),
            assertions=[],
            extractors=draft.extractors,
            request_override_spec=draft.request_overrides,
        )
        test_case = ApiTestCase.objects.create(
            project=api_request.collection.project,
            request=api_request,
            name=draft.name,
            description=draft.description,
            status=draft.status,
            tags=draft.tags,
            script=script,
            assertions=[],
            creator=creator,
        )
        apply_test_case_override_payload(test_case, draft.request_overrides)
        apply_test_case_assertions_and_extractors(
            test_case,
            assertion_payload=draft.assertions,
            extractor_payload=draft.extractors,
        )
        created_cases.append(test_case)
    return created_cases
