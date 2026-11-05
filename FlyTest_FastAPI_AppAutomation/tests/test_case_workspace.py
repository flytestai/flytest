import unittest
from tests import test_app_api_smoke as smoke


class CaseWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.harness = smoke.AppApiSmokeTests()
        self.harness.setUp()
        self.client = self.harness.client

    def tearDown(self):
        self.harness.tearDown()

    def test_group_priority_and_flow_extension_roundtrip(self):
        payload = {
            "project_id": 1, "name": "登录回归用例", "description": "",
            "package_id": None, "timeout": 300, "retry_count": 0,
            "variables": [], "tags": ["smoke"],
            "ui_flow": {"steps": [{"type": "click", "config": {}}],
                        "feice_meta": {"group": "登录与注册", "priority": "P0", "custom": "keep"}},
        }
        response = self.client.post("/test-cases/", json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        item = response.json()["data"]
        self.assertEqual(item["ui_flow"], payload["ui_flow"])
        payload["ui_flow"]["feice_meta"]["group"] = "回归用例"
        updated = self.client.put(f'/test-cases/{item["id"]}/', json=payload)
        self.assertEqual(updated.status_code, 200, updated.text)
        listed = self.client.get("/test-cases/?project_id=1").json()["data"]
        self.assertEqual(listed[0]["ui_flow"]["feice_meta"], payload["ui_flow"]["feice_meta"])
        self.assertEqual(listed[0]["tags"], ["smoke"])
