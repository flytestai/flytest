import threading
import unittest
from unittest.mock import patch
from tests import test_app_api_smoke as smoke
from app import database


class SuiteWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.h = smoke.AppApiSmokeTests()
        self.h.setUp()
        self.client = self.h.client
        cases = [self.h.create_test_case(name=f"case-{i}") for i in range(4)]
        self.payload = {"project_id": 1001, "name": "parallel-suite", "description": "", "test_case_ids": [c["id"] for c in cases], "group": "回归测试", "execution_strategy": "parallel"}
        response = self.client.post("/test-suites/", json=self.payload)
        self.assertEqual(response.status_code, 200, response.text)
        self.suite = response.json()["data"]
        now = database.utc_now()
        with database.connection() as conn:
            for serial in ("parallel-1", "parallel-2"):
                conn.execute("INSERT INTO devices(device_id,status,created_at,updated_at) VALUES (?, 'available', ?, ?)", (serial, now, now))
            self.devices = [item["id"] for item in database.fetch_all(conn, "SELECT id FROM devices ORDER BY id")]

    def tearDown(self):
        self.h.tearDown()

    def test_metadata_roundtrip_and_old_client_preserves_group(self):
        self.assertEqual(self.suite["group"], "回归测试")
        self.assertEqual(self.suite["execution_strategy"], "parallel")
        payload = {k: v for k, v in self.payload.items() if k not in ("group", "execution_strategy")}
        result = self.client.put(f'/test-suites/{self.suite["id"]}/', json=payload)
        self.assertEqual(result.status_code, 200, result.text)
        self.assertEqual(result.json()["data"]["group"], "回归测试")
        self.assertEqual(result.json()["data"]["execution_strategy"], "parallel")

    def test_parallel_assignment_uses_distinct_device_queues(self):
        from app import suite_workspace
        received, done = [], threading.Event()
        def capture(suite_id, queues):
            received.extend(queues)
            done.set()
        with patch.object(suite_workspace, "run_parallel_queues", capture):
            response = self.client.post(f'/test-suites/{self.suite["id"]}/run-parallel/', json={"device_ids": self.devices})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertTrue(done.wait(2))
        self.assertEqual([len(q) for q in received], [2, 2])
        with database.connection() as conn:
            records = database.fetch_all(conn, "SELECT * FROM executions ORDER BY id")
        self.assertEqual([r["device_id"] for r in records], [self.devices[0], self.devices[1], self.devices[0], self.devices[1]])
        self.assertTrue(all(r["test_suite_id"] == self.suite["id"] for r in records))

    def test_occupied_device_rolls_back_first_reservation(self):
        with database.connection() as conn:
            conn.execute("UPDATE devices SET status='locked',locked_by='other' WHERE id=?", (self.devices[1],))
        response = self.client.post(f'/test-suites/{self.suite["id"]}/run-parallel/', json={"device_ids": self.devices})
        self.assertEqual(response.status_code, 409, response.text)
        with database.connection() as conn:
            devices = database.fetch_all(conn, "SELECT * FROM devices ORDER BY id")
            records = database.fetch_all(conn, "SELECT * FROM executions")
        self.assertEqual(devices[0]["status"], "available")
        self.assertEqual(devices[1]["locked_by"], "other")
        self.assertFalse(records)

    def test_duplicate_devices_are_rejected(self):
        response = self.client.post(f'/test-suites/{self.suite["id"]}/run-parallel/', json={"device_ids": [self.devices[0]] * 2})
        self.assertEqual(response.status_code, 400, response.text)

    def test_queue_workers_run_concurrently(self):
        from app import suite_workspace, extended_routes
        barrier = threading.Barrier(2)
        seen = []
        def worker(suite, ids):
            barrier.wait(timeout=2)
            seen.append(ids)
        with patch.object(extended_routes, "run_suite_background", worker):
            suite_workspace.run_parallel_queues(1, [[1, 3], [2, 4]])
        self.assertEqual(len(seen), 2)
