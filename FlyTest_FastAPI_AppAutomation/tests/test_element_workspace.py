import unittest

from tests import test_app_api_smoke as smoke


class ElementWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.harness = smoke.AppApiSmokeTests()
        self.harness.setUp()
        self.client = self.harness.client

    def tearDown(self):
        self.harness.tearDown()

    def test_locator_metadata_roundtrip_and_duplicate_guard(self):
        payload = {"project_id": 1, "name": "账号输入框", "element_type": "locator", "selector_type": "resource-id", "selector_value": "com.feice:id/account", "description": "登录字段", "tags": ["登录"], "image_path": "", "is_active": True, "config": {"page_name": "登录注册", "ui_type": "input", "reusable": True, "maintenance_status": "normal", "custom_timeout": 8}}
        response = self.client.post("/elements/", json=payload)
        self.assertEqual(response.status_code, 200, response.text)
        record = response.json()["data"]
        self.assertEqual(record["selector_type"], "resource-id")
        self.assertEqual(record["config"], payload["config"])
        payload["config"]["maintenance_status"] = "needs_maintenance"
        updated = self.client.put(f'/elements/{record["id"]}/', json=payload)
        self.assertEqual(updated.status_code, 200, updated.text)
        self.assertEqual(updated.json()["data"]["config"]["custom_timeout"], 8)
        records = self.client.get("/elements/?project_id=1").json()["data"]
        self.assertEqual(records[0]["config"]["page_name"], "登录注册")
        self.assertTrue(records[0]["config"]["reusable"])
        self.assertEqual(records[0]["config"]["maintenance_status"], "needs_maintenance")
        self.assertEqual(self.client.post("/elements/", json=payload).status_code, 409)
