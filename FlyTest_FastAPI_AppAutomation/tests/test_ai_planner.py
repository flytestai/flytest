import unittest

from app.ai_planner import (
    build_fallback_scene_plan,
    build_fallback_step_suggestion,
    extract_json_object,
    normalize_scene_plan_payload,
    normalize_step_suggestion_payload,
)


def make_context():
    packages = [
        {
            "id": 1,
            "name": "企业微信",
            "package_name": "com.tencent.wework",
            "activity_name": ".LaunchActivity",
        }
    ]
    elements = [
        {
            "id": 1,
            "name": "账号输入框",
            "element_type": "input",
            "selector_type": "id",
            "selector_value": "username_input",
            "description": "登录页账号输入框",
            "tags": ["登录", "账号"],
            "config": {},
        },
        {
            "id": 2,
            "name": "密码输入框",
            "element_type": "input",
            "selector_type": "id",
            "selector_value": "password_input",
            "description": "登录页密码输入框",
            "tags": ["登录", "密码"],
            "config": {},
        },
        {
            "id": 3,
            "name": "登录按钮",
            "element_type": "button",
            "selector_type": "text",
            "selector_value": "登录",
            "description": "登录提交按钮",
            "tags": ["登录", "提交"],
            "config": {},
        },
        {
            "id": 4,
            "name": "首页消息入口",
            "element_type": "button",
            "selector_type": "text",
            "selector_value": "消息",
            "description": "首页消息入口",
            "tags": ["首页", "消息"],
            "config": {},
        },
    ]
    custom_components = [
        {
            "id": 1,
            "name": "登录公共流程",
            "type": "login_flow_component",
            "default_config": {},
            "steps": [
                {
                    "name": "点击登录按钮",
                    "type": "touch",
                    "config": {"selector_type": "element", "selector": "登录按钮"},
                }
            ],
        }
    ]

    return {
        "project_id": 101,
        "packages": packages,
        "elements": elements,
        "components": [],
        "custom_components": custom_components,
        "package_name_lookup": {
            "企业微信": packages[0],
            "com.tencent.wework": packages[0],
        },
        "element_lookup": {
            "账号输入框": elements[0],
            "密码输入框": elements[1],
            "登录按钮": elements[2],
            "首页消息入口": elements[3],
        },
        "custom_component_type_lookup": {
            "login_flow_component": custom_components[0],
        },
        "custom_component_name_lookup": {
            "登录公共流程": custom_components[0],
        },
    }


class AIPlannerTests(unittest.TestCase):
    def test_fallback_plan_builds_login_flow(self):
        plan = build_fallback_scene_plan(
            make_context(),
            {
                "project_id": 101,
                "prompt": "启动企业微信，输入账号密码登录，进入首页后校验消息入口存在",
                "package_id": 1,
            },
        )

        step_types = [step["type"] for step in plan["steps"]]
        variable_names = [item["name"] for item in plan["variables"]]

        self.assertEqual(plan["mode"], "fallback")
        self.assertIn("launch_app", step_types)
        self.assertIn("text", step_types)
        self.assertIn("assert_exists", step_types)
        self.assertIn("login_username", variable_names)
        self.assertIn("login_password", variable_names)

    def test_normalize_scene_plan_maps_aliases_and_custom_components(self):
        warnings = []
        plan = normalize_scene_plan_payload(
            {
                "name": "AI 登录场景",
                "description": "通过 AI 生成",
                "package_name": "企业微信",
                "variables": [{"name": "account", "type": "string", "value": "demo"}],
                "steps": [
                    {
                        "name": "点击账号输入框",
                        "type": "click",
                        "selector_type": "element",
                        "selector": "账号输入框",
                    },
                    {
                        "name": "输入账号",
                        "type": "input",
                        "selector_type": "element",
                        "selector": "账号输入框",
                        "text": "{{account}}",
                    },
                    {
                        "name": "执行公共登录流程",
                        "type": "login_flow_component",
                    },
                ],
                "summary": "done",
            },
            make_context(),
            {"project_id": 101, "prompt": "登录企业微信"},
            warnings,
        )

        self.assertEqual(plan["package_id"], 1)
        self.assertEqual(plan["steps"][0]["type"], "touch")
        self.assertEqual(plan["steps"][1]["type"], "text")
        self.assertEqual(plan["steps"][1]["config"]["text"], "{{account}}")
        self.assertEqual(plan["steps"][2]["kind"], "custom")
        self.assertGreater(len(plan["steps"][2]["steps"]), 0)
        self.assertEqual(warnings, [])

    def test_fallback_plan_handles_generic_click_assert_and_snapshot(self):
        plan = build_fallback_scene_plan(
            make_context(),
            {
                "project_id": 101,
                "prompt": "启动企业微信，点击登录按钮，校验首页消息入口存在，并截图",
                "package_id": 1,
            },
        )

        step_types = [step["type"] for step in plan["steps"]]
        self.assertIn("launch_app", step_types)
        self.assertIn("touch", step_types)
        self.assertIn("assert_exists", step_types)
        self.assertIn("snapshot", step_types)

    def test_fallback_plan_builds_literal_input_steps(self):
        context = make_context()
        context["elements"].append(
            {
                "id": 5,
                "name": "搜索框",
                "element_type": "input",
                "selector_type": "id",
                "selector_value": "search_input",
                "description": "全局搜索输入框",
                "tags": ["搜索"],
                "config": {},
            }
        )

        plan = build_fallback_scene_plan(
            context,
            {
                "project_id": 101,
                "prompt": '点击搜索框并输入"FlyTest"',
                "package_id": 1,
            },
        )

        text_steps = [step for step in plan["steps"] if step["type"] == "text"]
        self.assertGreaterEqual(len(text_steps), 1)
        self.assertEqual(text_steps[0]["config"]["text"], "FlyTest")

    def test_normalize_step_suggestion_keeps_current_type(self):
        context = make_context()
        suggestion = normalize_step_suggestion_payload(
            {
                "step": {
                    "name": "补全点击登录",
                    "config": {
                        "selector_type": "element",
                        "selector": context["elements"][2]["name"],
                    },
                },
                "summary": "补全完成",
            },
            context,
            {
                "project_id": 101,
                "prompt": "点击登录按钮",
                "current_step": {
                    "name": "",
                    "type": "touch",
                    "config": {},
                },
            },
        )

        self.assertEqual(suggestion["step"]["type"], "touch")
        self.assertEqual(suggestion["step"]["config"]["selector"], context["elements"][2]["name"])
        self.assertEqual(suggestion["summary"], "补全完成")

    def test_fallback_step_suggestion_generates_variable_for_text_input(self):
        context = make_context()
        suggestion = build_fallback_step_suggestion(
            context,
            {
                "project_id": 101,
                "prompt": "定位账号输入框并补全文本步骤",
                "package_id": 1,
                "current_step": {
                    "name": "",
                    "type": "text",
                    "config": {},
                },
                "current_variables": [],
            },
        )

        self.assertEqual(suggestion["mode"], "fallback")
        self.assertEqual(suggestion["step"]["type"], "text")
        self.assertEqual(suggestion["step"]["config"]["selector"], context["elements"][0]["name"])
        self.assertTrue(str(suggestion["step"]["config"]["text"]).strip())

    def test_extract_json_object_from_markdown(self):
        payload = extract_json_object(
            """
            Here is the result:
            ```json
            {"name":"demo","steps":[]}
            ```
            """
        )
        self.assertEqual(payload["name"], "demo")


if __name__ == "__main__":
    unittest.main()
