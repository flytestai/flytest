from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Optional

from django.conf import settings

from .models import Skill


@dataclass(frozen=True)
class SkillRuntimeSpec:
    name: str
    description: str
    content: str
    path: Optional[str] = None
    source: str = "bundled"


def clear_skill_runtime_cache() -> None:
    _load_bundled_skill_specs.cache_clear()


def _candidate_bundled_skill_dirs() -> list[Path]:
    candidates: list[Path] = []

    configured_dir = getattr(settings, "BUNDLED_SKILLS_DIR", "") or os.environ.get(
        "BUNDLED_SKILLS_DIR", ""
    )
    if configured_dir:
        candidates.append(Path(configured_dir))

    candidates.append(Path(settings.BASE_DIR) / "bundled_skills")
    candidates.append(Path(settings.BASE_DIR).parent / "FlyTest_Skills")
    candidates.append(Path("/app/bundled_skills"))

    unique_candidates: list[Path] = []
    seen: set[str] = set()
    for candidate in candidates:
        candidate_key = str(candidate.resolve(strict=False))
        if candidate_key in seen:
            continue
        seen.add(candidate_key)
        unique_candidates.append(candidate)

    return unique_candidates


def _build_virtual_skill_specs() -> dict[str, SkillRuntimeSpec]:
    kb_search_content = """---
name: kb-search
description: Search the knowledge base with the built-in `knowledge_search` tool when you need business rules, documentation context, or product constraints.
---

# Knowledge Base Search

This is a guidance-only skill.

Use the built-in `knowledge_search` tool directly instead of `execute_skill_script`.

Recommended workflow:
1. Summarize what information is missing.
2. Query `knowledge_search` with short, specific keywords.
3. Use the returned evidence to refine your testcase generation.

Do not call `execute_skill_script` for this skill because it has no local script.
"""

    return {
        "kb-search": SkillRuntimeSpec(
            name="kb-search",
            description=(
                "Search the knowledge base with the built-in `knowledge_search` tool "
                "when testcase generation needs project context."
            ),
            content=kb_search_content,
            path=None,
            source="virtual",
        )
    }


@lru_cache(maxsize=1)
def _load_bundled_skill_specs() -> dict[str, SkillRuntimeSpec]:
    bundled_specs: dict[str, SkillRuntimeSpec] = {}

    for root_dir in _candidate_bundled_skill_dirs():
        if not root_dir.is_dir():
            continue

        for entry in sorted(root_dir.iterdir()):
            if not entry.is_dir():
                continue

            skill_md_path = entry / "SKILL.md"
            if not skill_md_path.is_file():
                continue

            try:
                skill_content = skill_md_path.read_text(encoding="utf-8")
                parsed = Skill.parse_skill_md(skill_content)
            except Exception:
                continue

            bundled_specs.setdefault(
                parsed["name"],
                SkillRuntimeSpec(
                    name=parsed["name"],
                    description=parsed["description"],
                    content=skill_content,
                    path=str(entry.resolve()),
                    source="bundled",
                ),
            )

    for name, spec in _build_virtual_skill_specs().items():
        bundled_specs.setdefault(name, spec)

    return bundled_specs


def _build_db_skill_spec(skill: Skill) -> SkillRuntimeSpec:
    return SkillRuntimeSpec(
        name=skill.name,
        description=skill.description,
        content=skill.skill_content or "",
        path=skill.get_full_path(),
        source="database",
    )


def get_skill_runtime_spec(skill_name: str) -> Optional[SkillRuntimeSpec]:
    if not skill_name:
        return None

    skill = Skill.objects.filter(name=skill_name, is_active=True).first()
    if skill:
        return _build_db_skill_spec(skill)

    return _load_bundled_skill_specs().get(skill_name)


def get_available_skill_specs() -> list[SkillRuntimeSpec]:
    spec_map = dict(_load_bundled_skill_specs())

    for skill in Skill.objects.filter(is_active=True).order_by("name"):
        spec_map[skill.name] = _build_db_skill_spec(skill)

    return [spec_map[name] for name in sorted(spec_map)]


def get_available_skill_names() -> list[str]:
    return [spec.name for spec in get_available_skill_specs()]
