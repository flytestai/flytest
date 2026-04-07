from __future__ import annotations

import json
import re
from typing import Any
from urllib import error as urllib_error
from urllib import request as urllib_request

from .database import fetch_all, json_loads
from .execution_runtime import SUPPORTED_BUILTIN_ACTIONS


FLOW_ACTIONS = {"sequence", "if", "loop", "try"}
SUPPORTED_STEP_TYPES = set(SUPPORTED_BUILTIN_ACTIONS) | FLOW_ACTIONS

ACTION_ALIASES = {
    "api": "api_request",
    "assert_text": "assert_exists",
    "back_key": "back",
    "click": "touch",
    "close_app": "stop_app",
    "input": "text",
    "launch": "launch_app",
    "open_app": "launch_app",
    "press": "touch",
    "screen_shot": "snapshot",
    "screenshot": "snapshot",
    "sleep": "wait",
    "tap": "touch",
    "type": "text",
}

META_KEYS = {
    "id",
    "name",
    "kind",
    "type",
    "action",
    "component_type",
    "component_name",
    "steps",
    "then_steps",
    "try_steps",
    "else_steps",
    "catch_steps",
    "finally_steps",
    "_expanded",
}

DEFAULT_AI_TIMEOUT_SECONDS = 45
MAX_PROMPT_COMPONENTS = 32
MAX_PROMPT_CUSTOM_COMPONENTS = 16
MAX_PROMPT_ELEMENTS = 48
MAX_PROMPT_PACKAGES = 12
PROMPT_SEGMENT_SPLIT_RE = re.compile(r"[，,。；;]|然后|之后|接着|并且|随后|再|then|after that", re.IGNORECASE)
LOGIN_PROMPT_KEYWORDS = ("登录", "login", "signin", "sign in")
SEARCH_PROMPT_KEYWORDS = ("搜索", "search")
TOUCH_PROMPT_KEYWORDS = ("点击", "点开", "打开", "进入", "选择", "tap", "click", "press", "open")
INPUT_PROMPT_KEYWORDS = ("输入", "填写", "键入", "录入", "type", "input", "enter")
ASSERT_PROMPT_KEYWORDS = ("校验", "断言", "检查", "确认", "验证", "存在", "显示", "可见", "assert", "verify", "check")
SNAPSHOT_PROMPT_KEYWORDS = ("截图", "snapshot", "screenshot", "截屏", "保存图片")
WAIT_PROMPT_KEYWORDS = ("等待", "wait", "稍等", "停留")
BACK_PROMPT_KEYWORDS = ("返回", "back")
HOME_PROMPT_KEYWORDS = ("首页", "home", "桌面")


def build_scene_plan(conn, request_payload: dict[str, Any]) -> dict[str, Any]:
    context = load_planner_context(conn, int(request_payload["project_id"]))
    warnings: list[str] = []

    llm_config = normalize_llm_config(request_payload.get("llm_config"))
    if llm_config.get("api_url") and llm_config.get("name"):
        try:
            raw_payload = request_scene_plan_from_llm(llm_config, context, request_payload)
            normalized = normalize_scene_plan_payload(raw_payload, context, request_payload, warnings)
            normalized["mode"] = "llm"
            normalized["provider"] = str(llm_config.get("provider") or "openai_compatible")
            normalized["model"] = str(llm_config.get("name") or "")
            normalized["warnings"] = warnings
            return normalized
        except Exception as exc:  # pragma: no cover - network path is covered by fallback tests
            warnings.append(f"AI 场景规划未生效，已回退到规则规划。原因: {exc}")
    else:
        warnings.append("未检测到可用的 AI 模型配置，已使用规则规划生成场景。")

    fallback = build_fallback_scene_plan(context, request_payload)
    fallback["warnings"] = warnings + list(fallback.get("warnings") or [])
    return fallback


def build_step_suggestion(conn, request_payload: dict[str, Any]) -> dict[str, Any]:
    context = load_planner_context(conn, int(request_payload["project_id"]))
    warnings: list[str] = []

    llm_config = normalize_llm_config(request_payload.get("llm_config"))
    if llm_config.get("api_url") and llm_config.get("name"):
        try:
            raw_payload = request_step_suggestion_from_llm(llm_config, context, request_payload)
            normalized = normalize_step_suggestion_payload(raw_payload, context, request_payload, warnings)
            normalized["mode"] = "llm"
            normalized["provider"] = str(llm_config.get("provider") or "openai_compatible")
            normalized["model"] = str(llm_config.get("name") or "")
            normalized["warnings"] = warnings
            return normalized
        except Exception as exc:  # pragma: no cover - network path is covered by fallback tests
            warnings.append(f"AI 步骤补全未生效，已回退到规则补全。原因: {exc}")
    else:
        warnings.append("未检测到可用的 AI 模型配置，已使用规则补全当前步骤。")

    fallback = build_fallback_step_suggestion(context, request_payload)
    fallback["warnings"] = warnings + list(fallback.get("warnings") or [])
    return fallback


def load_planner_context(conn, project_id: int) -> dict[str, Any]:
    packages = [dict(row) for row in fetch_all(conn, "SELECT * FROM packages WHERE project_id = ? ORDER BY updated_at DESC", (project_id,))]
    elements = [dict(row) for row in fetch_all(conn, "SELECT * FROM elements WHERE project_id = ? AND is_active = 1 ORDER BY updated_at DESC", (project_id,))]
    components = [dict(row) for row in fetch_all(conn, "SELECT * FROM components WHERE enabled = 1 ORDER BY sort_order ASC, updated_at DESC")]
    custom_components = [
        dict(row)
        for row in fetch_all(conn, "SELECT * FROM custom_components WHERE enabled = 1 ORDER BY sort_order ASC, updated_at DESC")
    ]

    for element in elements:
        element["tags"] = json_loads(element.get("tags"), [])
        element["config"] = json_loads(element.get("config"), {})

    for component in components:
        component["schema"] = json_loads(component.get("schema_json"), {})
        component["default_config"] = json_loads(component.get("default_config"), {})

    for component in custom_components:
        component["schema"] = json_loads(component.get("schema_json"), {})
        component["default_config"] = json_loads(component.get("default_config"), {})
        component["steps"] = json_loads(component.get("steps_json"), [])

    package_name_lookup: dict[str, dict[str, Any]] = {}
    for package in packages:
        for value in (package.get("name"), package.get("package_name")):
            key = normalize_lookup_key(value)
            if key:
                package_name_lookup[key] = package

    element_lookup: dict[str, dict[str, Any]] = {}
    for element in elements:
        for value in (element.get("name"), element.get("selector_value")):
            key = normalize_lookup_key(value)
            if key and key not in element_lookup:
                element_lookup[key] = element

    custom_component_type_lookup = {
        normalize_lookup_key(item.get("type")): item for item in custom_components if normalize_lookup_key(item.get("type"))
    }
    custom_component_name_lookup = {
        normalize_lookup_key(item.get("name")): item for item in custom_components if normalize_lookup_key(item.get("name"))
    }

    return {
        "project_id": project_id,
        "packages": packages,
        "elements": elements,
        "components": components,
        "custom_components": custom_components,
        "package_name_lookup": package_name_lookup,
        "element_lookup": element_lookup,
        "custom_component_type_lookup": custom_component_type_lookup,
        "custom_component_name_lookup": custom_component_name_lookup,
    }


def normalize_llm_config(config: Any) -> dict[str, Any]:
    if not isinstance(config, dict):
        return {}

    return {
        "config_name": str(config.get("config_name") or "").strip(),
        "provider": str(config.get("provider") or "openai_compatible").strip() or "openai_compatible",
        "name": str(config.get("name") or "").strip(),
        "api_url": str(config.get("api_url") or "").strip(),
        "api_key": str(config.get("api_key") or "").strip(),
        "system_prompt": str(config.get("system_prompt") or "").strip(),
        "supports_vision": bool(config.get("supports_vision")),
    }


def request_scene_plan_from_llm(
    llm_config: dict[str, Any],
    context: dict[str, Any],
    request_payload: dict[str, Any],
) -> dict[str, Any]:
    system_prompt = build_llm_system_prompt(context, request_payload, llm_config)
    user_prompt = build_llm_user_prompt(context, request_payload)
    response_text = call_openai_compatible_chat(llm_config, system_prompt, user_prompt)
    return extract_json_object(response_text)


def build_llm_system_prompt(
    context: dict[str, Any],
    request_payload: dict[str, Any],
    llm_config: dict[str, Any],
) -> str:
    system_parts = [
        "你是 FlyTest 的 APP 自动化场景规划助手。",
        "你的目标是把用户描述转换成可执行、稳定的 APP 自动化场景 JSON。",
        "你必须只返回一个 JSON 对象，不能输出 Markdown、解释或代码块。",
        "JSON 顶层字段固定为: name, description, package_id, package_name, summary, variables, steps。",
        "steps 中每个步骤只能使用这些内置类型之一: "
        + ", ".join(sorted(SUPPORTED_STEP_TYPES))
        + "；如果需要调用自定义组件，请把 kind 设为 custom，并且 type/component_type 使用已存在的自定义组件类型。",
        "优先使用 selector_type=element 且 selector 为项目中已存在的元素名称，这比直接写 XPath 或坐标更稳定。",
        "对于文本输入步骤，请使用 type=text，并在 config 中提供 text 字段。",
        "对于应用启动步骤，请使用 type=launch_app，并在 config 中提供 package_name；如有 activity_name 也可补充。",
        "对于流程控制，sequence/if/loop/try 使用 steps、else_steps、catch_steps、finally_steps 组织子步骤。",
        "如果信息不足，请生成可编辑的占位步骤和变量，而不是留空。",
        "避免生成不存在的组件类型、无效字段或空步骤。",
    ]

    if llm_config.get("system_prompt"):
        system_parts.append(f"额外系统提示: {llm_config['system_prompt']}")

    component_lines = []
    for item in context["components"][:MAX_PROMPT_COMPONENTS]:
        component_lines.append(
            f"- {item.get('type')}: {item.get('name')} ({item.get('category') or 'general'})"
        )
    if component_lines:
        system_parts.append("可用基础组件:\n" + "\n".join(component_lines))

    custom_component_lines = []
    for item in context["custom_components"][:MAX_PROMPT_CUSTOM_COMPONENTS]:
        custom_component_lines.append(
            f"- {item.get('type')}: {item.get('name')}，约 {len(item.get('steps') or [])} 个子步骤"
        )
    if custom_component_lines:
        system_parts.append("可用自定义组件:\n" + "\n".join(custom_component_lines))

    element_lines = []
    for item in context["elements"][:MAX_PROMPT_ELEMENTS]:
        selector_value = str(item.get("selector_value") or "").strip()
        if len(selector_value) > 64:
            selector_value = f"{selector_value[:61]}..."
        detail = selector_value or str(item.get("description") or "").strip()
        suffix = f" - {detail}" if detail else ""
        element_lines.append(f"- {item.get('name')} ({item.get('element_type')}/{item.get('selector_type')}){suffix}")
    if element_lines:
        system_parts.append("项目可用元素:\n" + "\n".join(element_lines))

    package_lines = []
    for item in context["packages"][:MAX_PROMPT_PACKAGES]:
        package_lines.append(
            f"- id={item.get('id')}, name={item.get('name')}, package_name={item.get('package_name')}, activity={item.get('activity_name') or ''}"
        )
    if package_lines:
        system_parts.append("项目可用应用包:\n" + "\n".join(package_lines))

    if request_payload.get("current_steps"):
        system_parts.append("如果用户已经有当前草稿，请尽量复用现有上下文并补足缺失步骤。")

    return "\n\n".join(part for part in system_parts if part)


def build_llm_user_prompt(context: dict[str, Any], request_payload: dict[str, Any]) -> str:
    current_steps = request_payload.get("current_steps") if isinstance(request_payload.get("current_steps"), list) else []
    current_variables = (
        request_payload.get("current_variables") if isinstance(request_payload.get("current_variables"), list) else []
    )

    payload = {
        "project_id": context["project_id"],
        "user_prompt": str(request_payload.get("prompt") or "").strip(),
        "preferred_package_id": request_payload.get("package_id"),
        "current_case_name": str(request_payload.get("current_case_name") or "").strip(),
        "current_description": str(request_payload.get("current_description") or "").strip(),
        "current_steps": current_steps,
        "current_variables": current_variables,
        "expected_output_schema": {
            "name": "string",
            "description": "string",
            "package_id": "number|null",
            "package_name": "string|null",
            "summary": "string",
            "variables": [
                {
                    "name": "string",
                    "scope": "local|global",
                    "type": "string|number|boolean|array|object",
                    "value": "any",
                    "description": "string",
                }
            ],
            "steps": [
                {
                    "name": "string",
                    "type": "supported step type",
                    "kind": "base|custom",
                    "component_type": "string",
                    "config": {},
                    "steps": [],
                    "else_steps": [],
                    "catch_steps": [],
                    "finally_steps": [],
                }
            ],
        },
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def request_step_suggestion_from_llm(
    llm_config: dict[str, Any],
    context: dict[str, Any],
    request_payload: dict[str, Any],
) -> dict[str, Any]:
    system_prompt = build_step_llm_system_prompt(context, request_payload, llm_config)
    user_prompt = build_step_llm_user_prompt(context, request_payload)
    response_text = call_openai_compatible_chat(llm_config, system_prompt, user_prompt)
    return extract_json_object(response_text)


def build_step_llm_system_prompt(
    context: dict[str, Any],
    request_payload: dict[str, Any],
    llm_config: dict[str, Any],
) -> str:
    current_step = request_payload.get("current_step") if isinstance(request_payload.get("current_step"), dict) else {}
    preferred_type = current_step_type(current_step)
    system_parts = [
        "你是 FlyTest 的 APP 自动化单步补全助手。",
        "你的目标是根据用户描述，为当前步骤生成一个更完整、可执行、稳定的步骤 JSON。",
        "你必须只返回一个 JSON 对象，不要输出 Markdown、解释或代码块。",
        "JSON 顶层字段固定为: step, summary, variables。",
        "step 必须是一个步骤对象；variables 是可选变量数组；summary 是一句话说明补全内容。",
        "优先沿用当前步骤类型；如果用户明确要求变更类型，才允许调整。",
        "步骤 type 只能使用这些内置类型之一: " + ", ".join(sorted(SUPPORTED_STEP_TYPES)),
        "对于点击、输入、断言步骤，优先使用 selector_type=element 和已有元素名称。",
        "对于文本输入步骤，请在 config 中提供 text 字段；如果用户没有给出字面值，可以使用变量表达式。",
        "如果需要新增变量，请在 variables 中返回结构化变量定义。",
    ]

    if preferred_type:
        system_parts.append(f"当前步骤优先类型: {preferred_type}")

    if llm_config.get("system_prompt"):
        system_parts.append(f"额外系统提示: {llm_config['system_prompt']}")

    element_lines = []
    for item in context["elements"][:MAX_PROMPT_ELEMENTS]:
        selector_value = str(item.get("selector_value") or "").strip()
        detail = selector_value or str(item.get("description") or "").strip()
        suffix = f" - {detail}" if detail else ""
        element_lines.append(f"- {item.get('name')} ({item.get('element_type')}/{item.get('selector_type')}){suffix}")
    if element_lines:
        system_parts.append("项目可用元素:\n" + "\n".join(element_lines))

    package_lines = []
    for item in context["packages"][:MAX_PROMPT_PACKAGES]:
        package_lines.append(
            f"- id={item.get('id')}, name={item.get('name')}, package_name={item.get('package_name')}, activity={item.get('activity_name') or ''}"
        )
    if package_lines:
        system_parts.append("项目可用应用包:\n" + "\n".join(package_lines))

    return "\n\n".join(part for part in system_parts if part)


def build_step_llm_user_prompt(context: dict[str, Any], request_payload: dict[str, Any]) -> str:
    current_step = request_payload.get("current_step") if isinstance(request_payload.get("current_step"), dict) else {}
    current_variables = (
        request_payload.get("current_variables") if isinstance(request_payload.get("current_variables"), list) else []
    )

    payload = {
        "project_id": context["project_id"],
        "user_prompt": str(request_payload.get("prompt") or "").strip(),
        "preferred_package_id": request_payload.get("package_id"),
        "current_case_name": str(request_payload.get("current_case_name") or "").strip(),
        "current_description": str(request_payload.get("current_description") or "").strip(),
        "current_step": current_step,
        "current_variables": current_variables,
        "expected_output_schema": {
            "step": {
                "name": "string",
                "type": "supported step type",
                "kind": "base|custom",
                "component_type": "string",
                "config": {},
                "steps": [],
                "else_steps": [],
                "catch_steps": [],
                "finally_steps": [],
            },
            "variables": [
                {
                    "name": "string",
                    "scope": "local|global",
                    "type": "string|number|boolean|array|object",
                    "value": "any",
                    "description": "string",
                }
            ],
            "summary": "string",
        },
    }
    return json.dumps(payload, ensure_ascii=False, indent=2)


def call_openai_compatible_chat(llm_config: dict[str, Any], system_prompt: str, user_prompt: str) -> str:
    url = normalize_chat_completions_url(str(llm_config.get("api_url") or ""))
    model_name = str(llm_config.get("name") or "").strip()
    if not url or not model_name:
        raise ValueError("缺少可用的 LLM 地址或模型名称")

    body = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    api_key = str(llm_config.get("api_key") or "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    request = urllib_request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib_request.urlopen(request, timeout=DEFAULT_AI_TIMEOUT_SECONDS) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore").strip()
        raise ValueError(detail or f"LLM 请求失败: HTTP {exc.code}") from exc
    except urllib_error.URLError as exc:
        raise ValueError(f"LLM 服务不可达: {exc.reason}") from exc

    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ValueError("LLM 响应缺少 choices 字段")

    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    content = message.get("content") if isinstance(message, dict) else ""

    if isinstance(content, list):
        text_parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text_parts.append(str(item.get("text") or ""))
        content = "\n".join(part for part in text_parts if part)

    if not isinstance(content, str) or not content.strip():
        raise ValueError("LLM 响应内容为空")

    return content


def normalize_chat_completions_url(api_url: str) -> str:
    cleaned = api_url.strip().rstrip("/")
    if not cleaned:
        return ""
    if cleaned.endswith("/chat/completions"):
        return cleaned
    if cleaned.endswith("/v1"):
        return f"{cleaned}/chat/completions"
    if "/chat/completions" in cleaned:
        return cleaned
    return f"{cleaned}/v1/chat/completions"


def extract_json_object(text: str) -> dict[str, Any]:
    content = str(text or "").strip()
    if not content:
        raise ValueError("AI 响应为空")

    fenced_match = re.search(r"```json\s*(\{.*?\})\s*```", content, re.DOTALL | re.IGNORECASE)
    if fenced_match:
        return json.loads(fenced_match.group(1))

    if content.startswith("{") and content.endswith("}"):
        return json.loads(content)

    decoder = json.JSONDecoder()
    for start_index, char in enumerate(content):
        if char != "{":
            continue
        try:
            payload, _ = decoder.raw_decode(content[start_index:])
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict):
            return payload

    raise ValueError("未能从 AI 响应中解析出合法 JSON")


def normalize_scene_plan_payload(
    raw_payload: Any,
    context: dict[str, Any],
    request_payload: dict[str, Any],
    warnings: list[str] | None = None,
) -> dict[str, Any]:
    if not isinstance(raw_payload, dict):
        raise ValueError("AI 响应不是 JSON 对象")

    plan_warnings = warnings if warnings is not None else []
    package_id = resolve_package_id(
        raw_payload.get("package_id"),
        raw_payload.get("package_name"),
        context,
        request_payload.get("package_id"),
    )

    variables = normalize_variables(raw_payload.get("variables"))
    steps = normalize_steps(raw_payload.get("steps"), context, plan_warnings)
    if not steps:
        raise ValueError("AI 生成结果中没有可执行步骤")

    prompt = str(request_payload.get("prompt") or "").strip()
    fallback_name = infer_case_name_from_prompt(prompt)
    name = str(raw_payload.get("name") or request_payload.get("current_case_name") or fallback_name).strip() or "APP 自动化场景"
    description = (
        str(raw_payload.get("description") or request_payload.get("current_description") or prompt).strip()
        or "由 FlyTest AI 生成的 APP 自动化场景"
    )
    summary = (
        str(raw_payload.get("summary") or "").strip()
        or f"已生成 {len(steps)} 个步骤，可先检查元素映射与断言配置后再保存。"
    )

    return {
        "name": name,
        "description": description,
        "package_id": package_id,
        "variables": variables,
        "steps": steps,
        "summary": summary,
    }


def normalize_step_suggestion_payload(
    raw_payload: Any,
    context: dict[str, Any],
    request_payload: dict[str, Any],
    warnings: list[str] | None = None,
) -> dict[str, Any]:
    if not isinstance(raw_payload, dict):
        raise ValueError("AI 步骤补全结果不是 JSON 对象")

    suggestion_warnings = warnings if warnings is not None else []
    current_step = request_payload.get("current_step") if isinstance(request_payload.get("current_step"), dict) else {}
    step_payload = raw_payload.get("step") if isinstance(raw_payload.get("step"), dict) else raw_payload

    if not isinstance(step_payload, dict):
        raise ValueError("AI 步骤补全结果缺少有效的 step 字段")

    merged_payload = clone_step_payload(current_step)
    merged_payload.update({key: value for key, value in step_payload.items() if value is not None})

    preferred_type = current_step_type(current_step)
    if not first_non_empty(
        merged_payload.get("type"),
        merged_payload.get("action"),
        merged_payload.get("component_type"),
        merged_payload.get("component_name"),
    ) and preferred_type:
        merged_payload["type"] = preferred_type

    step = normalize_step(merged_payload, context, suggestion_warnings, depth=0, path="step")
    if step is None:
        raise ValueError("AI 步骤补全结果中没有可执行步骤")

    summary = str(raw_payload.get("summary") or "").strip() or f"已补全当前步骤：{step.get('name') or build_default_step_name(current_step_type(step) or 'touch')}"
    return {
        "step": step,
        "variables": normalize_variables(raw_payload.get("variables")),
        "summary": summary,
    }


def normalize_variables(items: Any) -> list[dict[str, Any]]:
    if not isinstance(items, list):
        return []

    normalized: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue

        value = item.get("value", item.get("default"))
        value_type = str(item.get("type") or infer_variable_type(value)).strip().lower()
        if value_type not in {"string", "number", "boolean", "array", "object"}:
            value_type = infer_variable_type(value)

        normalized.append(
            {
                "name": name,
                "scope": "global" if str(item.get("scope") or "").strip().lower() == "global" else "local",
                "type": value_type,
                "value": value,
                "description": str(item.get("description") or "").strip(),
            }
        )
    return normalized


def normalize_steps(items: Any, context: dict[str, Any], warnings: list[str], *, depth: int = 0) -> list[dict[str, Any]]:
    if not isinstance(items, list):
        return []

    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(items, start=1):
        step = normalize_step(item, context, warnings, depth=depth, path=f"{depth + 1}.{index}")
        if step is not None:
            normalized.append(step)
    return normalized


def normalize_step(
    item: Any,
    context: dict[str, Any],
    warnings: list[str],
    *,
    depth: int,
    path: str,
) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        warnings.append(f"已忽略非法步骤节点 {path}。")
        return None

    raw_type = first_non_empty(item.get("type"), item.get("action"), item.get("component_type"), item.get("component_name"))
    normalized_type = normalize_step_type(raw_type)

    custom_component = resolve_custom_component(normalized_type, item, context)
    if custom_component is not None:
        inline_steps = item.get("steps")
        if not isinstance(inline_steps, list) or not inline_steps:
            inline_steps = custom_component.get("steps") or []
        return {
            "name": str(item.get("name") or custom_component.get("name") or "自定义组件").strip() or "自定义组件",
            "kind": "custom",
            "type": str(custom_component.get("type") or ""),
            "action": str(custom_component.get("type") or ""),
            "component_type": str(custom_component.get("type") or ""),
            "config": normalize_step_config(item, action_type=str(custom_component.get("type") or ""), context=context),
            "steps": normalize_steps(inline_steps, context, warnings, depth=depth + 1),
        }

    if normalized_type in FLOW_ACTIONS:
        return normalize_flow_step(item, normalized_type, context, warnings, depth=depth, path=path)

    if not normalized_type:
        normalized_type = infer_step_type_from_payload(item)

    if normalized_type not in SUPPORTED_STEP_TYPES:
        warnings.append(f"步骤 {path} 使用了不支持的类型 {raw_type!r}，已忽略。")
        return None

    config = normalize_step_config(item, action_type=normalized_type, context=context)
    return {
        "name": str(item.get("name") or build_default_step_name(normalized_type)).strip() or build_default_step_name(normalized_type),
        "kind": "base",
        "type": normalized_type,
        "action": normalized_type,
        "component_type": normalized_type,
        "config": config,
    }


def normalize_flow_step(
    item: dict[str, Any],
    action_type: str,
    context: dict[str, Any],
    warnings: list[str],
    *,
    depth: int,
    path: str,
) -> dict[str, Any]:
    config = normalize_step_config(item, action_type=action_type, context=context)
    step = {
        "name": str(item.get("name") or build_default_step_name(action_type)).strip() or build_default_step_name(action_type),
        "kind": "base",
        "type": action_type,
        "action": action_type,
        "component_type": action_type,
        "config": config,
        "steps": [],
    }

    if action_type == "if":
        primary_steps = item.get("then_steps", item.get("steps"))
        step["steps"] = normalize_steps(primary_steps, context, warnings, depth=depth + 1)
        step["else_steps"] = normalize_steps(item.get("else_steps"), context, warnings, depth=depth + 1)
        return step

    if action_type == "try":
        primary_steps = item.get("try_steps", item.get("steps"))
        step["steps"] = normalize_steps(primary_steps, context, warnings, depth=depth + 1)
        step["catch_steps"] = normalize_steps(item.get("catch_steps"), context, warnings, depth=depth + 1)
        step["finally_steps"] = normalize_steps(item.get("finally_steps"), context, warnings, depth=depth + 1)
        return step

    step["steps"] = normalize_steps(item.get("steps"), context, warnings, depth=depth + 1)
    return step


def _legacy_build_fallback_scene_plan(context: dict[str, Any], request_payload: dict[str, Any]) -> dict[str, Any]:
    prompt = str(request_payload.get("prompt") or "").strip()
    lowered_prompt = prompt.lower()
    warnings: list[str] = []

    package_id = resolve_package_id(None, None, context, request_payload.get("package_id"))
    package = next((item for item in context["packages"] if item.get("id") == package_id), None)

    variables: list[dict[str, Any]] = []
    steps: list[dict[str, Any]] = []

    if package is not None:
        launch_config = {"package_name": str(package.get("package_name") or "").strip()}
        activity_name = str(package.get("activity_name") or "").strip()
        if activity_name:
            launch_config["activity_name"] = activity_name
        steps.append(build_base_step("启动应用", "launch_app", launch_config))

    matched_custom_component = find_custom_component_by_prompt(lowered_prompt, context)
    if matched_custom_component is not None:
        steps.append(
            {
                "name": str(matched_custom_component.get("name") or "自定义组件"),
                "kind": "custom",
                "type": str(matched_custom_component.get("type") or ""),
                "action": str(matched_custom_component.get("type") or ""),
                "component_type": str(matched_custom_component.get("type") or ""),
                "config": dict(matched_custom_component.get("default_config") or {}),
                "steps": normalize_steps(matched_custom_component.get("steps"), context, warnings),
            }
        )

    if any(keyword in lowered_prompt for keyword in ("登录", "login", "signin", "sign in")):
        username_element = find_element_by_keywords(context, ["账号", "用户名", "手机号", "邮箱", "username", "account", "phone", "email"])
        password_element = find_element_by_keywords(context, ["密码", "password", "pwd"])
        submit_element = find_element_by_keywords(context, ["登录", "提交", "确认", "sign in", "login", "立即登录"])
        home_element = find_element_by_keywords(context, ["首页", "工作台", "首页tab", "home", "dashboard"])

        variables.extend(
            [
                {"name": "login_username", "scope": "local", "type": "string", "value": "", "description": "登录账号"},
                {"name": "login_password", "scope": "local", "type": "string", "value": "", "description": "登录密码"},
            ]
        )

        if username_element is not None:
            steps.append(build_element_step("点击账号输入框", "touch", username_element["name"]))
            steps.append(build_base_step("输入账号", "text", {"selector_type": "element", "selector": username_element["name"], "text": "{{login_username}}"}))
        else:
            warnings.append("未识别到账号输入元素，已保留账号变量，请在场景中补充目标元素。")

        if password_element is not None:
            steps.append(build_element_step("点击密码输入框", "touch", password_element["name"]))
            steps.append(build_base_step("输入密码", "text", {"selector_type": "element", "selector": password_element["name"], "text": "{{login_password}}"}))
        else:
            warnings.append("未识别到密码输入元素，已保留密码变量，请在场景中补充目标元素。")

        if submit_element is not None:
            steps.append(build_element_step("点击登录按钮", "touch", submit_element["name"]))

        if home_element is not None:
            steps.append(build_base_step("校验首页入口存在", "assert_exists", {"selector_type": "element", "selector": home_element["name"], "timeout": 15}))

    if any(keyword in lowered_prompt for keyword in ("搜索", "search")):
        search_input = find_element_by_keywords(context, ["搜索", "search", "关键词"])
        search_button = find_element_by_keywords(context, ["搜索按钮", "查询", "search"])
        if search_input is not None:
            variables.append({"name": "search_keyword", "scope": "local", "type": "string", "value": "", "description": "搜索关键字"})
            steps.append(build_element_step("点击搜索框", "touch", search_input["name"]))
            steps.append(build_base_step("输入搜索关键字", "text", {"selector_type": "element", "selector": search_input["name"], "text": "{{search_keyword}}"}))
        if search_button is not None:
            steps.append(build_element_step("执行搜索", "touch", search_button["name"]))

    if any(keyword in lowered_prompt for keyword in ("截图", "snapshot", "screenshot")):
        steps.append(build_base_step("保存截图", "snapshot", {"name": "ai-generated-snapshot"}))

    if not steps:
        wait_seconds = 2 if package is not None else 1
        steps = [
            build_base_step("等待页面稳定", "wait", {"seconds": wait_seconds}),
            build_base_step("保存当前截图", "snapshot", {"name": "app-scene-preview"}),
        ]
        warnings.append("规则规划未识别到明确业务动作，已生成可编辑的基础场景草稿。")

    normalized_variables = dedupe_variables(variables)
    normalized_steps = normalize_steps(steps, context, warnings)
    summary = f"已基于规则生成 {len(normalized_steps)} 个步骤，建议补充更具体的业务描述以获得更高质量的 AI 场景。"

    return {
        "name": str(request_payload.get("current_case_name") or infer_case_name_from_prompt(prompt)).strip() or "APP 自动化场景",
        "description": str(request_payload.get("current_description") or prompt or "由 FlyTest 规则规划生成").strip(),
        "package_id": package_id,
        "variables": normalized_variables,
        "steps": normalized_steps,
        "summary": summary,
        "mode": "fallback",
        "provider": "rule-based",
        "model": "",
        "warnings": warnings,
    }


def build_base_step(name: str, step_type: str, config: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "name": name,
        "kind": "base",
        "type": step_type,
        "action": step_type,
        "component_type": step_type,
        "config": config or {},
    }


def build_element_step(name: str, step_type: str, element_name: str) -> dict[str, Any]:
    return build_base_step(name, step_type, {"selector_type": "element", "selector": element_name})


def normalize_step_config(item: dict[str, Any], *, action_type: str, context: dict[str, Any]) -> dict[str, Any]:
    base_config = dict(item.get("config") or {}) if isinstance(item.get("config"), dict) else {}
    for key, value in item.items():
        if key in META_KEYS:
            continue
        if key not in base_config:
            base_config[key] = value

    if "selector" not in base_config and "selector_value" in base_config:
        base_config["selector"] = base_config.get("selector_value")
    if "selector" not in base_config and "element_name" in base_config:
        base_config["selector"] = base_config.get("element_name")

    selector_candidate = first_non_empty(base_config.get("selector"), base_config.get("target"), base_config.get("element"))
    if selector_candidate and "selector" not in base_config:
        base_config["selector"] = selector_candidate

    if base_config.get("selector") and not base_config.get("selector_type"):
        matched_element = resolve_element(selector_candidate, context)
        if matched_element is not None:
            base_config["selector_type"] = "element"
            base_config["selector"] = matched_element["name"]

    if action_type in {"touch", "text", "assert_exists", "wait"} and not base_config.get("selector_type"):
        matched_element = resolve_element(item.get("name"), context)
        if matched_element is not None:
            base_config["selector_type"] = "element"
            base_config["selector"] = matched_element["name"]

    if action_type == "launch_app" and not base_config.get("package_name"):
        package_id = resolve_package_id(item.get("package_id"), item.get("package_name"), context, None)
        package = next((row for row in context["packages"] if row.get("id") == package_id), None)
        if package is not None:
            base_config["package_name"] = str(package.get("package_name") or "").strip()
            activity_name = str(package.get("activity_name") or "").strip()
            if activity_name and not base_config.get("activity_name"):
                base_config["activity_name"] = activity_name

    if action_type == "text":
        text_value = first_non_empty(base_config.get("text"), base_config.get("value"), base_config.get("content"))
        if text_value is not None:
            base_config["text"] = text_value

    if action_type == "wait":
        seconds = first_non_empty(base_config.get("seconds"), base_config.get("timeout"), base_config.get("duration"))
        if seconds is not None:
            base_config["seconds"] = seconds

    return base_config


def resolve_package_id(raw_package_id: Any, raw_package_name: Any, context: dict[str, Any], preferred_package_id: Any) -> int | None:
    for value in (preferred_package_id, raw_package_id):
        try:
            package_id = int(value)
        except (TypeError, ValueError):
            continue
        if any(int(item.get("id")) == package_id for item in context["packages"]):
            return package_id

    package_name = normalize_lookup_key(raw_package_name)
    if package_name and package_name in context["package_name_lookup"]:
        return int(context["package_name_lookup"][package_name]["id"])

    if len(context["packages"]) == 1:
        return int(context["packages"][0]["id"])
    return None


def resolve_element(value: Any, context: dict[str, Any]) -> dict[str, Any] | None:
    key = normalize_lookup_key(value)
    if not key:
        return None
    return context["element_lookup"].get(key)


def resolve_custom_component(step_type: str, item: dict[str, Any], context: dict[str, Any]) -> dict[str, Any] | None:
    direct = context["custom_component_type_lookup"].get(normalize_lookup_key(step_type))
    if direct is not None:
        return direct

    for candidate in (item.get("name"), item.get("component_name")):
        resolved = context["custom_component_name_lookup"].get(normalize_lookup_key(candidate))
        if resolved is not None:
            return resolved
    return None


def infer_case_name_from_prompt(prompt: str) -> str:
    cleaned = re.sub(r"\s+", " ", str(prompt or "").strip())
    if not cleaned:
        return "APP 自动化场景"
    return cleaned[:40]


def infer_variable_type(value: Any) -> str:
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return "number"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return "string"


def infer_step_type_from_payload(item: dict[str, Any]) -> str:
    if any(key in item for key in ("then_steps", "else_steps", "condition")):
        return "if"
    if any(key in item for key in ("try_steps", "catch_steps", "finally_steps")):
        return "try"
    if "url" in item and "method" in item:
        return "api_request"
    if any(key in item for key in ("text", "value", "content")):
        return "text"
    if any(key in item for key in ("start", "end", "direction")):
        return "swipe"
    return ""


def normalize_step_type(value: Any) -> str:
    raw = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    return ACTION_ALIASES.get(raw, raw)


def build_default_step_name(step_type: str) -> str:
    labels = {
        "api_request": "接口请求",
        "assert": "断言校验",
        "assert_exists": "存在性断言",
        "back": "返回上一页",
        "drag": "拖拽元素",
        "double_click": "双击元素",
        "foreach_assert": "批量断言",
        "home": "回到桌面",
        "if": "条件分支",
        "image_exists_click": "图片存在时点击",
        "image_exists_click_chain": "图片链式点击",
        "keyevent": "发送按键",
        "launch_app": "启动应用",
        "long_press": "长按元素",
        "loop": "循环步骤",
        "sequence": "顺序步骤",
        "set_variable": "设置变量",
        "snapshot": "保存截图",
        "stop_app": "关闭应用",
        "swipe": "滑动页面",
        "swipe_to": "滑动到目标",
        "text": "输入文本",
        "touch": "点击元素",
        "try": "异常处理",
        "unset_variable": "删除变量",
        "wait": "等待页面稳定",
    }
    return labels.get(step_type, step_type or "执行步骤")


def current_step_type(step: Any) -> str:
    if not isinstance(step, dict):
        return ""
    return normalize_step_type(
        first_non_empty(
            step.get("type"),
            step.get("action"),
            step.get("component_type"),
            step.get("component_name"),
        )
    )


def clone_step_payload(step: Any) -> dict[str, Any]:
    if not isinstance(step, dict):
        return {}
    return json.loads(json.dumps(step, ensure_ascii=False))


def infer_keyevent_from_prompt(prompt: str) -> str:
    normalized_prompt = normalize_lookup_key(prompt)
    if not normalized_prompt:
        return ""

    keyword_groups = (
        (("back", "返回", "后退"), "KEYCODE_BACK"),
        (("home", "首页", "桌面"), "KEYCODE_HOME"),
        (("menu", "菜单"), "KEYCODE_MENU"),
        (("enter", "确认", "回车", "提交", "搜索"), "KEYCODE_ENTER"),
        (("delete", "删除", "退格", "清空"), "KEYCODE_DEL"),
        (("power", "电源", "锁屏"), "KEYCODE_POWER"),
        (("camera", "拍照", "相机"), "KEYCODE_CAMERA"),
        (("volumeup", "音量+", "音量上", "调大音量"), "KEYCODE_VOLUME_UP"),
        (("volumedown", "音量-", "音量下", "调小音量"), "KEYCODE_VOLUME_DOWN"),
    )
    for keywords, keycode in keyword_groups:
        if any(normalize_lookup_key(keyword) in normalized_prompt for keyword in keywords):
            return keycode
    return ""


def infer_swipe_direction(prompt: str) -> str:
    normalized_prompt = normalize_lookup_key(prompt)
    if not normalized_prompt:
        return ""
    if any(keyword in normalized_prompt for keyword in ("向下", "下滑", "下拉", "swipedown", "down")):
        return "down"
    if any(keyword in normalized_prompt for keyword in ("向左", "左滑", "往左", "swipeleft", "left")):
        return "left"
    if any(keyword in normalized_prompt for keyword in ("向右", "右滑", "往右", "swiperight", "right")):
        return "right"
    if any(keyword in normalized_prompt for keyword in ("向上", "上滑", "上拉", "swipeup", "up")):
        return "up"
    return ""


def normalize_lookup_key(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or "").strip().lower())


def first_non_empty(*values: Any) -> Any:
    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def find_element_by_keywords(context: dict[str, Any], keywords: list[str]) -> dict[str, Any] | None:
    normalized_keywords = [normalize_lookup_key(keyword) for keyword in keywords if normalize_lookup_key(keyword)]
    if not normalized_keywords:
        return None

    for element in context["elements"]:
        haystack = normalize_lookup_key(
            " ".join(
                [
                    str(element.get("name") or ""),
                    str(element.get("description") or ""),
                    str(element.get("selector_value") or ""),
                    " ".join(str(tag) for tag in element.get("tags") or []),
                ]
            )
        )
        if any(keyword in haystack for keyword in normalized_keywords):
            return element
    return None


def find_custom_component_by_prompt(prompt: str, context: dict[str, Any]) -> dict[str, Any] | None:
    normalized_prompt = normalize_lookup_key(prompt)
    if not normalized_prompt:
        return None
    for component in context["custom_components"]:
        name_key = normalize_lookup_key(component.get("name"))
        type_key = normalize_lookup_key(component.get("type"))
        if (name_key and name_key in normalized_prompt) or (type_key and type_key in normalized_prompt):
            return component
    return None


def dedupe_variables(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: dict[str, dict[str, Any]] = {}
    for item in items:
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        deduped[name] = item
    return list(deduped.values())


def split_prompt_segments(prompt: str) -> list[str]:
    items = [segment.strip() for segment in PROMPT_SEGMENT_SPLIT_RE.split(str(prompt or "").strip())]
    return [item for item in items if item]


def extract_literal_text(segment: str) -> str | None:
    content = str(segment or "").strip()
    patterns = [
        r"[\"“”'‘’「」『』](.+?)[\"“”'‘’「」『』]",
        r"输入(.+)$",
        r"填写(.+)$",
        r"键入(.+)$",
        r"type\s+(.+)$",
    ]
    for pattern in patterns:
        matched = re.search(pattern, content, re.IGNORECASE)
        if not matched:
            continue
        value = matched.group(1).strip().strip("，,。；; ")
        if value:
            return value
    return None


def extract_wait_seconds(segment: str) -> float:
    matched = re.search(r"(\d+(?:\.\d+)?)\s*(?:秒|s|sec|second)", str(segment or ""), re.IGNORECASE)
    if matched:
        return max(float(matched.group(1)), 0.2)
    return 1.5


def build_prompt_variable_name(label: Any, reserved_names: set[str]) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", normalize_lookup_key(label)).strip("_")
    if not normalized:
        normalized = "input_value"
    if normalized[0].isdigit():
        normalized = f"value_{normalized}"

    candidate = normalized
    index = 2
    while candidate in reserved_names:
        candidate = f"{normalized}_{index}"
        index += 1
    return candidate


def build_snapshot_name(segment: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", normalize_lookup_key(segment)).strip("-")
    return normalized[:48] or "ai-generated-snapshot"


def score_element_match(normalized_segment: str, element: dict[str, Any], preferred_types: set[str]) -> int:
    score = 0
    name_key = normalize_lookup_key(element.get("name"))
    selector_key = normalize_lookup_key(element.get("selector_value"))
    description_key = normalize_lookup_key(element.get("description"))
    tag_keys = [normalize_lookup_key(tag) for tag in element.get("tags") or []]
    element_type = normalize_lookup_key(element.get("element_type"))

    if name_key and name_key in normalized_segment:
        score += len(name_key) + 60
    if selector_key and selector_key in normalized_segment:
        score += len(selector_key) + 36
    if description_key and len(description_key) >= 2 and description_key in normalized_segment:
        score += min(len(description_key), 24)
    for tag_key in tag_keys:
        if tag_key and tag_key in normalized_segment:
            score += min(len(tag_key), 18)
    if preferred_types and element_type in preferred_types:
        score += 20
    return score


def find_best_element_for_segment(
    segment: str,
    context: dict[str, Any],
    *,
    preferred_types: set[str] | None = None,
) -> dict[str, Any] | None:
    normalized_segment = normalize_lookup_key(segment)
    if not normalized_segment:
        return None

    preferred = {normalize_lookup_key(item) for item in (preferred_types or set()) if normalize_lookup_key(item)}
    best_match: dict[str, Any] | None = None
    best_score = 0

    for element in context["elements"]:
        score = score_element_match(normalized_segment, element, preferred)
        if score > best_score:
            best_score = score
            best_match = element
    return best_match


def build_generic_prompt_steps(
    prompt: str,
    context: dict[str, Any],
    *,
    existing_variable_names: set[str] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[str]]:
    variables: list[dict[str, Any]] = []
    warnings: list[str] = []
    steps: list[dict[str, Any]] = []
    step_signatures: set[str] = set()
    reserved_variable_names = {name for name in (existing_variable_names or set()) if name}

    def append_step(step: dict[str, Any]) -> None:
        signature = json.dumps(step, ensure_ascii=False, sort_keys=True)
        if signature not in step_signatures:
            step_signatures.add(signature)
            steps.append(step)

    for segment in split_prompt_segments(prompt):
        normalized_segment = normalize_lookup_key(segment)
        if not normalized_segment:
            continue
        if any(keyword in normalized_segment for keyword in LOGIN_PROMPT_KEYWORDS):
            continue
        if any(keyword in normalized_segment for keyword in SEARCH_PROMPT_KEYWORDS):
            continue

        matched_element = find_best_element_for_segment(segment, context)
        input_element = find_best_element_for_segment(segment, context, preferred_types={"input", "textarea", "search", "field"})

        if any(keyword in normalized_segment for keyword in BACK_PROMPT_KEYWORDS):
            append_step(build_base_step("返回上一页", "back", {}))

        if any(keyword in normalized_segment for keyword in HOME_PROMPT_KEYWORDS) and not any(
            keyword in normalized_segment for keyword in ASSERT_PROMPT_KEYWORDS
        ):
            append_step(build_base_step("回到首页", "home", {}))

        if any(keyword in normalized_segment for keyword in WAIT_PROMPT_KEYWORDS):
            append_step(build_base_step("等待页面稳定", "wait", {"seconds": extract_wait_seconds(segment)}))

        if matched_element is not None and any(keyword in normalized_segment for keyword in TOUCH_PROMPT_KEYWORDS):
            append_step(build_element_step(f"点击{matched_element['name']}", "touch", matched_element["name"]))

        if any(keyword in normalized_segment for keyword in INPUT_PROMPT_KEYWORDS):
            target_element = input_element or matched_element
            if target_element is not None:
                literal_text = extract_literal_text(segment)
                if literal_text is None:
                    variable_name = build_prompt_variable_name(target_element.get("name"), reserved_variable_names)
                    reserved_variable_names.add(variable_name)
                    variables.append(
                        {
                            "name": variable_name,
                            "scope": "local",
                            "type": "string",
                            "value": "",
                            "description": f"{target_element['name']} 输入值",
                        }
                    )
                    text_value = f"{{{{{variable_name}}}}}"
                else:
                    text_value = literal_text

                append_step(
                    build_base_step(
                        f"输入{target_element['name']}",
                        "text",
                        {"selector_type": "element", "selector": target_element["name"], "text": text_value},
                    )
                )
            else:
                warnings.append(f"未识别到可用于输入的元素，请补充定位: {segment}")

        if matched_element is not None and any(keyword in normalized_segment for keyword in ASSERT_PROMPT_KEYWORDS):
            append_step(
                build_base_step(
                    f"校验{matched_element['name']}存在",
                    "assert_exists",
                    {"selector_type": "element", "selector": matched_element["name"], "timeout": 15},
                )
            )

        if any(keyword in normalized_segment for keyword in SNAPSHOT_PROMPT_KEYWORDS):
            append_step(build_base_step("保存截图", "snapshot", {"name": build_snapshot_name(segment)}))

    return steps, variables, warnings


def build_fallback_step_suggestion(context: dict[str, Any], request_payload: dict[str, Any]) -> dict[str, Any]:
    prompt = str(request_payload.get("prompt") or "").strip()
    current_step = request_payload.get("current_step") if isinstance(request_payload.get("current_step"), dict) else {}
    warnings: list[str] = []
    variables: list[dict[str, Any]] = []

    base_payload = clone_step_payload(current_step)
    action_type = current_step_type(current_step) or "touch"
    if not first_non_empty(
        base_payload.get("type"),
        base_payload.get("action"),
        base_payload.get("component_type"),
        base_payload.get("component_name"),
    ):
        base_payload["type"] = action_type

    next_config = dict(base_payload.get("config") or {}) if isinstance(base_payload.get("config"), dict) else {}
    matched_element = find_best_element_for_segment(prompt, context)
    input_element = find_best_element_for_segment(prompt, context, preferred_types={"input", "textarea", "search", "field"})
    package_id = resolve_package_id(None, None, context, request_payload.get("package_id"))
    package = next((item for item in context["packages"] if item.get("id") == package_id), None)

    if action_type in {"touch", "double_click", "long_press", "assert_exists"}:
        if matched_element is not None:
            next_config["selector_type"] = "element"
            next_config["selector"] = matched_element["name"]
        if action_type == "assert_exists":
            next_config["timeout"] = extract_wait_seconds(prompt)
        if not base_payload.get("name"):
            base_payload["name"] = (
                f"校验{matched_element['name']}存在"
                if action_type == "assert_exists" and matched_element is not None
                else f"点击{matched_element['name']}" if matched_element is not None else build_default_step_name(action_type)
            )
    elif action_type == "text":
        target_element = input_element or matched_element
        literal_text = extract_literal_text(prompt)
        if target_element is not None:
            next_config["selector_type"] = "element"
            next_config["selector"] = target_element["name"]
        if literal_text is not None:
            next_config["text"] = literal_text
        else:
            variable_name = build_prompt_variable_name(
                target_element.get("name") if target_element is not None else base_payload.get("name") or "input_value",
                {str(item.get("name") or "").strip() for item in normalize_variables(request_payload.get("current_variables"))},
            )
            variables.append(
                {
                    "name": variable_name,
                    "scope": "local",
                    "type": "string",
                    "value": "",
                    "description": f"{(target_element or {}).get('name') or '当前步骤'} 输入值",
                }
            )
            next_config["text"] = f"{{{{{variable_name}}}}}"
        if not base_payload.get("name"):
            base_payload["name"] = f"输入{target_element['name']}" if target_element is not None else "输入文本"
    elif action_type == "wait":
        next_config["seconds"] = extract_wait_seconds(prompt)
        base_payload["name"] = base_payload.get("name") or "等待页面稳定"
    elif action_type == "snapshot":
        next_config["name"] = build_snapshot_name(prompt)
        base_payload["name"] = base_payload.get("name") or "保存截图"
    elif action_type in {"launch_app", "stop_app"}:
        if package is not None:
            next_config["package_name"] = str(package.get("package_name") or "").strip()
            if action_type == "launch_app":
                activity_name = str(package.get("activity_name") or "").strip()
                if activity_name:
                    next_config["activity_name"] = activity_name
        base_payload["name"] = base_payload.get("name") or build_default_step_name(action_type)
    elif action_type == "keyevent":
        keycode = infer_keyevent_from_prompt(prompt)
        if keycode:
            next_config["keycode"] = keycode
        base_payload["name"] = base_payload.get("name") or build_default_step_name(action_type)
    elif action_type == "swipe":
        direction = infer_swipe_direction(prompt)
        if direction:
            next_config["direction"] = direction
        next_config["duration"] = max(float(next_config.get("duration") or 0.4), 0.2)
        if not base_payload.get("name"):
            base_payload["name"] = "滑动页面"
    elif action_type == "swipe_to":
        target_element = matched_element
        if target_element is not None:
            next_config["target_selector_type"] = "element"
            next_config["target_selector"] = target_element["name"]
        direction = infer_swipe_direction(prompt)
        if direction:
            next_config["direction"] = direction
        base_payload["name"] = base_payload.get("name") or "滑动到目标"

    base_payload["config"] = next_config
    step = normalize_step(base_payload, context, warnings, depth=0, path="step")
    if step is None:
        raise ValueError("规则补全未生成有效步骤")

    summary = f"已基于规则补全当前步骤：{step.get('name') or build_default_step_name(action_type)}"
    return {
        "step": step,
        "variables": dedupe_variables(variables),
        "summary": summary,
        "mode": "fallback",
        "provider": "rule-based",
        "model": "",
        "warnings": warnings,
    }


def build_fallback_scene_plan(context: dict[str, Any], request_payload: dict[str, Any]) -> dict[str, Any]:
    prompt = str(request_payload.get("prompt") or "").strip()
    lowered_prompt = prompt.lower()
    warnings: list[str] = []

    package_id = resolve_package_id(None, None, context, request_payload.get("package_id"))
    package = next((item for item in context["packages"] if item.get("id") == package_id), None)

    variables: list[dict[str, Any]] = []
    steps: list[dict[str, Any]] = []
    step_signatures: set[str] = set()

    def append_step(step: dict[str, Any]) -> None:
        signature = json.dumps(step, ensure_ascii=False, sort_keys=True)
        if signature not in step_signatures:
            step_signatures.add(signature)
            steps.append(step)

    if package is not None:
        launch_config = {"package_name": str(package.get("package_name") or "").strip()}
        activity_name = str(package.get("activity_name") or "").strip()
        if activity_name:
            launch_config["activity_name"] = activity_name
        append_step(build_base_step("启动应用", "launch_app", launch_config))

    matched_custom_component = find_custom_component_by_prompt(lowered_prompt, context)
    if matched_custom_component is not None:
        append_step(
            {
                "name": str(matched_custom_component.get("name") or "自定义组件").strip() or "自定义组件",
                "kind": "custom",
                "type": str(matched_custom_component.get("type") or ""),
                "action": str(matched_custom_component.get("type") or ""),
                "component_type": str(matched_custom_component.get("type") or ""),
                "config": dict(matched_custom_component.get("default_config") or {}),
                "steps": normalize_steps(matched_custom_component.get("steps"), context, warnings),
            }
        )

    if any(keyword in lowered_prompt for keyword in LOGIN_PROMPT_KEYWORDS):
        username_element = find_element_by_keywords(context, ["账号", "用户名", "手机号", "邮箱", "username", "account", "phone", "email"])
        password_element = find_element_by_keywords(context, ["密码", "password", "pwd"])
        submit_element = find_element_by_keywords(context, ["登录", "提交", "确认", "sign in", "login", "立即登录"])
        home_element = find_element_by_keywords(context, ["首页", "工作台", "首页tab", "home", "dashboard"])

        variables.extend(
            [
                {"name": "login_username", "scope": "local", "type": "string", "value": "", "description": "登录账号"},
                {"name": "login_password", "scope": "local", "type": "string", "value": "", "description": "登录密码"},
            ]
        )

        if username_element is not None:
            append_step(build_element_step("点击账号输入框", "touch", username_element["name"]))
            append_step(
                build_base_step(
                    "输入账号",
                    "text",
                    {"selector_type": "element", "selector": username_element["name"], "text": "{{login_username}}"},
                )
            )
        else:
            warnings.append("未识别到账号输入元素，请在场景中补充定位后再执行。")

        if password_element is not None:
            append_step(build_element_step("点击密码输入框", "touch", password_element["name"]))
            append_step(
                build_base_step(
                    "输入密码",
                    "text",
                    {"selector_type": "element", "selector": password_element["name"], "text": "{{login_password}}"},
                )
            )
        else:
            warnings.append("未识别到密码输入元素，请在场景中补充定位后再执行。")

        if submit_element is not None:
            append_step(build_element_step("点击登录按钮", "touch", submit_element["name"]))

        if home_element is not None:
            append_step(
                build_base_step(
                    "校验首页入口存在",
                    "assert_exists",
                    {"selector_type": "element", "selector": home_element["name"], "timeout": 15},
                )
            )

    if any(keyword in lowered_prompt for keyword in SEARCH_PROMPT_KEYWORDS):
        search_input = find_element_by_keywords(context, ["搜索", "search", "关键词"])
        search_button = find_element_by_keywords(context, ["搜索按钮", "查询", "search"])
        if search_input is not None:
            literal_search_text = extract_literal_text(prompt)
            if literal_search_text is None:
                variables.append(
                    {"name": "search_keyword", "scope": "local", "type": "string", "value": "", "description": "搜索关键字"}
                )
                search_text = "{{search_keyword}}"
            else:
                search_text = literal_search_text
            append_step(build_element_step("点击搜索框", "touch", search_input["name"]))
            append_step(
                build_base_step(
                    "输入搜索关键字",
                    "text",
                    {"selector_type": "element", "selector": search_input["name"], "text": search_text},
                )
            )
        if search_button is not None:
            append_step(build_element_step("执行搜索", "touch", search_button["name"]))

    generic_steps, generic_variables, generic_warnings = build_generic_prompt_steps(
        prompt,
        context,
        existing_variable_names={str(item.get("name") or "").strip() for item in variables},
    )
    variables.extend(generic_variables)
    warnings.extend(generic_warnings)
    for item in generic_steps:
        append_step(item)

    if any(keyword in lowered_prompt for keyword in SNAPSHOT_PROMPT_KEYWORDS):
        append_step(build_base_step("保存截图", "snapshot", {"name": "ai-generated-snapshot"}))

    if not steps:
        wait_seconds = 2 if package is not None else 1
        steps = [
            build_base_step("等待页面稳定", "wait", {"seconds": wait_seconds}),
            build_base_step("保存当前截图", "snapshot", {"name": "app-scene-preview"}),
        ]
        warnings.append("规则规划暂未识别到明确业务动作，已生成可继续编辑的基础场景草稿。")

    normalized_variables = dedupe_variables(variables)
    normalized_steps = normalize_steps(steps, context, warnings)
    summary = f"已基于规则生成 {len(normalized_steps)} 个步骤，建议补充更具体的业务描述以获得更高质量的 AI 场景。"

    return {
        "name": str(request_payload.get("current_case_name") or infer_case_name_from_prompt(prompt)).strip() or "APP 自动化场景",
        "description": str(request_payload.get("current_description") or prompt or "由 FlyTest 规则规划生成").strip(),
        "package_id": package_id,
        "variables": normalized_variables,
        "steps": normalized_steps,
        "summary": summary,
        "mode": "fallback",
        "provider": "rule-based",
        "model": "",
        "warnings": warnings,
    }
