import unittest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from tests import test_app_api_smoke as smoke
from app import database, environment_workspace as workspace


class EnvironmentWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.h = smoke.AppApiSmokeTests()
        self.h.setUp()
        self.client = self.h.client
        self.base = '/settings/environments/'
        self.payload = {'name': '测试服务', 'kind': 'service', 'platform': 'none', 'network': 'intranet', 'endpoint': 'https://service.example.test', 'device_ids': [], 'description': '环境说明', 'enabled': True}

    def tearDown(self):
        self.h.tearDown()

    def create(self, **overrides):
        response = self.client.post(self.base, params={'project_id': 1001}, json={**self.payload, **overrides})
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()['data']

    def test_scope_and_updates_invalidate_health(self):
        record = self.create()
        with patch.object(workspace.socket, 'create_connection', return_value=MagicMock()):
            result = self.client.post(f'{self.base}{record["id"]}/probe/', params={'project_id': 1001})
        self.assertEqual(result.json()['data']['health'], 'available')
        self.assertEqual(self.client.get(self.base, params={'project_id': 1002}).json()['data'], [])
        result = self.client.put(f'{self.base}{record["id"]}/', params={'project_id': 1001}, json={**self.payload, 'name': '修改配置'})
        self.assertEqual(result.json()['data']['health'], 'unchecked')
        self.assertIsNone(result.json()['data']['checked_at'])
        self.assertEqual(self.client.delete(f'{self.base}{record["id"]}/', params={'project_id': 1002}).status_code, 404)
        self.assertEqual(self.client.delete(f'{self.base}{record["id"]}/', params={'project_id': 1001}).status_code, 200)

    def test_import_is_atomic_and_never_trusts_health(self):
        invalid = {**self.payload, 'kind': 'device', 'platform': 'android', 'device_ids': [9999]}
        response = self.client.post(self.base+'import/', params={'project_id': 1001}, json={'profiles': [self.payload, invalid]})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.client.get(self.base, params={'project_id': 1001}).json()['data'], [])
        response = self.client.post(self.base+'import/', params={'project_id': 1001}, json={'profiles': [{**self.payload, 'health': 'available', 'enabled': False}]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data'][0]['health'], 'unchecked')

    def test_batch_is_atomic_and_does_not_stop_services(self):
        record = self.create()
        response = self.client.post(self.base+'batch/', params={'project_id': 1001}, json={'ids': [record['id'], 'missing'], 'enabled': False})
        self.assertEqual(response.status_code, 404)
        self.assertTrue(self.client.get(self.base, params={'project_id': 1001}).json()['data'][0]['enabled'])
        response = self.client.post(self.base+'batch/', params={'project_id': 1001}, json={'ids': [record['id']], 'enabled': False})
        self.assertFalse(response.json()['data'][0]['enabled'])
        with patch.object(workspace.socket, 'create_connection') as connect:
            self.client.post(f'{self.base}{record["id"]}/probe/', params={'project_id': 1001})
            connect.assert_not_called()

    def test_probe_revision_guard(self):
        record = self.create()
        def changed(value):
            workspace.update_profile(record['id'], workspace.EnvironmentPayload(**{**self.payload, 'enabled': False}), 1001)
            return 'available', 'stale result'
        with patch.object(workspace, 'probe', side_effect=changed):
            response = self.client.post(f'{self.base}{record["id"]}/probe/', params={'project_id': 1001})
        self.assertEqual(response.status_code, 409)
        current = self.client.get(self.base, params={'project_id': 1001}).json()['data'][0]
        self.assertEqual(current['health'], 'unchecked')

    def test_unsupported_platform_and_connection_failure(self):
        cloud = self.create(kind='cloud', platform='ios', endpoint='')
        self.assertEqual(self.client.post(f'{self.base}{cloud["id"]}/probe/', params={'project_id': 1001}).json()['data']['health'], 'unchecked')
        service = self.create()
        with patch.object(workspace.socket, 'create_connection', side_effect=OSError('offline')):
            self.assertEqual(self.client.post(f'{self.base}{service["id"]}/probe/', params={'project_id': 1001}).json()['data']['health'], 'error')

    def test_device_probe_uses_actual_adb_results(self):
        with database.connection() as conn:
            conn.execute('INSERT INTO devices(device_id,status,created_at,updated_at) VALUES (?, ?, ?, ?)', ('env-device', 'available', database.utc_now(), database.utc_now()))
            device_id = database.fetch_one(conn, 'SELECT id FROM devices WHERE device_id=?', ('env-device',))['id']
        record = self.create(kind='device', platform='android', device_ids=[device_id], endpoint='')
        with patch('app.adb.inspect_adb_environment', return_value={'executable_found': True, 'devices': [], 'error': ''}):
            response = self.client.post(f'{self.base}{record["id"]}/probe/', params={'project_id': 1001})
            self.assertEqual(response.json()['data']['health'], 'error')
        with patch('app.adb.inspect_adb_environment', return_value={'executable_found': True, 'devices': [{'device_id': 'env-device', 'status': 'available'}], 'error': ''}):
            self.assertEqual(self.client.post(f'{self.base}{record["id"]}/probe/', params={'project_id': 1001}).json()['data']['health'], 'available')

    def test_permission_and_validation(self):
        with patch.object(workspace, 'ensure_project_access', side_effect=HTTPException(403, 'denied')):
            self.assertEqual(self.client.get(self.base, params={'project_id': 1001}).status_code, 403)
        for override in [{'name': '   '}, {'endpoint': 'https://user:secret@example.test'}, {'endpoint': 'file:///etc/passwd'}, {'kind': 'device', 'device_ids': []}]:
            self.assertEqual(self.client.post(self.base, params={'project_id': 1001}, json={**self.payload, **override}).status_code, 422)
