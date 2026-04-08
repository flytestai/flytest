from __future__ import annotations

import sys
import tempfile
from pathlib import Path

from django.test import TestCase, override_settings

from orchestrator_integration.builtin_tools.skill_tools import get_skill_tools
from skills.runtime_registry import (
    clear_skill_runtime_cache,
    get_available_skill_names,
    get_skill_runtime_spec,
)


class BundledSkillFallbackTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.temp_dir = tempfile.TemporaryDirectory()
        self.skills_root = Path(self.temp_dir.name)

        whart_dir = self.skills_root / "flytest_skills"
        whart_dir.mkdir(parents=True, exist_ok=True)
        (whart_dir / "SKILL.md").write_text(
            """---
name: whart-test
description: Tooling for testcase management.
---

# whart-test

Use this skill to manage testcases.
""",
            encoding="utf-8",
        )
        (whart_dir / "echo_tool.py").write_text(
            "import sys\nprint('bundled skill ok')\nprint(sys.executable)\n",
            encoding="utf-8",
        )

        self.settings_override = override_settings(BUNDLED_SKILLS_DIR=self.temp_dir.name)
        self.settings_override.enable()
        clear_skill_runtime_cache()

    def tearDown(self) -> None:
        clear_skill_runtime_cache()
        self.settings_override.disable()
        self.temp_dir.cleanup()
        super().tearDown()

    def test_runtime_registry_loads_bundled_skill_when_database_is_empty(self) -> None:
        skill_spec = get_skill_runtime_spec("whart-test")

        self.assertIsNotNone(skill_spec)
        assert skill_spec is not None
        self.assertEqual(skill_spec.name, "whart-test")
        self.assertEqual(skill_spec.source, "bundled")
        self.assertIn("manage testcases", skill_spec.content)
        self.assertIn("whart-test", get_available_skill_names())

    def test_read_and_execute_skill_tools_use_bundled_skill(self) -> None:
        tools = get_skill_tools(user_id=1, project_id=1)
        read_tool = next(tool for tool in tools if tool.name == "read_skill_content")
        execute_tool = next(
            tool for tool in tools if tool.name == "execute_skill_script"
        )

        read_result = read_tool.invoke({"skill_name": "whart-test"})
        execute_result = execute_tool.invoke(
            {"skill_name": "whart-test", "command": "python echo_tool.py"}
        )

        self.assertIn("Use this skill to manage testcases", read_result)
        self.assertIn("bundled skill ok", execute_result)
        self.assertIn(sys.executable, execute_result)

    def test_virtual_kb_search_skill_returns_guidance_instead_of_missing_error(self) -> None:
        tools = get_skill_tools(user_id=1, project_id=1)
        read_tool = next(tool for tool in tools if tool.name == "read_skill_content")
        execute_tool = next(
            tool for tool in tools if tool.name == "execute_skill_script"
        )

        read_result = read_tool.invoke({"skill_name": "kb-search"})
        execute_result = execute_tool.invoke(
            {"skill_name": "kb-search", "command": "python kb_search.py"}
        )

        self.assertIn("knowledge_search", read_result)
        self.assertIn("guidance-only", execute_result)
