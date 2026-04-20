from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from .database import fetch_all
from .execution_runtime import SUPPORTED_BUILTIN_ACTIONS, normalize_action

FLOW_ACTIONS = {"sequence", "if", "loop", "try"}


def _step_path(path: str, suffix: str) -> str:
    return f"{path}.{suffix}" if path else suffix


def _known_custom_component_types(conn) -> set[str]:
    return {
        str(row.get("type") or "").strip()
        for row in fetch_all(conn, "SELECT type FROM custom_components")
        if str(row.get("type") or "").strip()
    }


def validate_scene_steps_payload(
    conn,
    steps: Any,
    *,
    allow_custom_steps: bool,
    path: str = "steps",
) -> None:
    if not isinstance(steps, list):
        raise HTTPException(status_code=400, detail=f"{path} must be a list of step objects")

    known_custom_types = _known_custom_component_types(conn) if allow_custom_steps else set()
    _validate_step_list(steps, known_custom_types=known_custom_types, allow_custom_steps=allow_custom_steps, path=path)


def _validate_step_list(
    steps: list[Any],
    *,
    known_custom_types: set[str],
    allow_custom_steps: bool,
    path: str,
) -> None:
    for index, item in enumerate(steps, start=1):
        item_path = _step_path(path, str(index))
        if not isinstance(item, dict):
            raise HTTPException(status_code=400, detail=f"{item_path} must be an object")
        _validate_step(item, known_custom_types=known_custom_types, allow_custom_steps=allow_custom_steps, path=item_path)


def _validate_step(
    step: dict[str, Any],
    *,
    known_custom_types: set[str],
    allow_custom_steps: bool,
    path: str,
) -> None:
    raw_action = str(
        step.get("action")
        or step.get("type")
        or step.get("component_type")
        or step.get("component_name")
        or ""
    ).strip()
    normalized_action = normalize_action(step)
    kind = str(step.get("kind") or "").strip().lower()
    inline_steps = step.get("steps")
    has_inline_steps = isinstance(inline_steps, list)
    is_custom_step = bool(raw_action) and raw_action not in SUPPORTED_BUILTIN_ACTIONS and raw_action in known_custom_types

    if kind == "custom":
        is_custom_step = True

    if normalized_action in FLOW_ACTIONS:
        _validate_flow_step(
            step,
            normalized_action=normalized_action,
            known_custom_types=known_custom_types,
            allow_custom_steps=allow_custom_steps,
            path=path,
        )
        return

    if normalized_action in SUPPORTED_BUILTIN_ACTIONS:
        if has_inline_steps:
            _validate_step_list(
                inline_steps,
                known_custom_types=known_custom_types,
                allow_custom_steps=allow_custom_steps,
                path=_step_path(path, "steps"),
            )
        return

    if is_custom_step:
        if not allow_custom_steps:
            raise HTTPException(status_code=400, detail=f"{path} cannot use custom component step '{raw_action}'")
        if has_inline_steps:
            _validate_step_list(
                inline_steps,
                known_custom_types=known_custom_types,
                allow_custom_steps=allow_custom_steps,
                path=_step_path(path, "steps"),
            )
        return

    if not raw_action:
        raise HTTPException(status_code=400, detail=f"{path} is missing an action or type")
    raise HTTPException(status_code=400, detail=f"{path} uses unsupported action type '{raw_action}'")


def _validate_flow_step(
    step: dict[str, Any],
    *,
    normalized_action: str,
    known_custom_types: set[str],
    allow_custom_steps: bool,
    path: str,
) -> None:
    if normalized_action == "if":
        _validate_step_list(
            step.get("then_steps", step.get("steps", [])),
            known_custom_types=known_custom_types,
            allow_custom_steps=allow_custom_steps,
            path=_step_path(path, "then_steps"),
        )
        else_steps = step.get("else_steps", [])
        if not isinstance(else_steps, list):
            raise HTTPException(status_code=400, detail=f"{path}.else_steps must be a list")
        _validate_step_list(
            else_steps,
            known_custom_types=known_custom_types,
            allow_custom_steps=allow_custom_steps,
            path=_step_path(path, "else_steps"),
        )
        return

    if normalized_action == "try":
        _validate_step_list(
            step.get("try_steps", step.get("steps", [])),
            known_custom_types=known_custom_types,
            allow_custom_steps=allow_custom_steps,
            path=_step_path(path, "try_steps"),
        )
        for group_name in ("catch_steps", "finally_steps"):
            group_steps = step.get(group_name, [])
            if not isinstance(group_steps, list):
                raise HTTPException(status_code=400, detail=f"{path}.{group_name} must be a list")
            _validate_step_list(
                group_steps,
                known_custom_types=known_custom_types,
                allow_custom_steps=allow_custom_steps,
                path=_step_path(path, group_name),
            )
        return

    _validate_step_list(
        step.get("steps", []),
        known_custom_types=known_custom_types,
        allow_custom_steps=allow_custom_steps,
        path=_step_path(path, "steps"),
    )
