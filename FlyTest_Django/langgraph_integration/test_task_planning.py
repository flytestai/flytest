import json
from types import SimpleNamespace
from unittest.mock import Mock, patch
from django.contrib.auth.models import User
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate
from .task_planning import TaskPlanningAPIView, validate_proposal


class TaskPlanningTests(SimpleTestCase):
    def request(self, authenticated=True, prompt='工作日北京时间八点执行'):
        request = APIRequestFactory().post('/lg/task-planning/', {'project_id': 1, 'prompt': prompt}, format='json')
        if authenticated:
            force_authenticate(request, User(username='review', is_superuser=True, is_active=True))
        return TaskPlanningAPIView.as_view()(request)

    def test_auth_and_project_scope(self):
        self.assertIn(self.request(False).status_code, (401, 403))
        with patch('langgraph_integration.views.check_project_permission', return_value=False):
            self.assertEqual(self.request().status_code, 403)

    @patch('langgraph_integration.views.check_project_permission', return_value=True)
    def test_no_model_and_prompt_bound(self, project):
        with patch('langgraph_integration.task_planning.get_user_active_llm_config', return_value=None):
            self.assertEqual(self.request().status_code, 503)
            self.assertEqual(self.request(prompt='x'*2001).status_code, 400)

    def test_cron_and_interval_boundaries(self):
        base = {'name': '回归', 'trigger_type': 'CRON', 'cron_expression': '0 0 * * 1-5'}
        self.assertEqual(validate_proposal(base)['cron_expression'], '0 0 * * 1-5')
        for cron in ['0 0 2 * * ?', '99 0 * * *', '*/0 * * * *', '0 0 0 * *', '0 0 * 13 *', '0 0 * * 5-1', '0 0 * * x']:
            with self.assertRaises(ValueError):
                validate_proposal({**base, 'cron_expression': cron})
        for seconds in [True, 59, 86401, '3600']:
            with self.assertRaises(ValueError):
                validate_proposal({**base, 'trigger_type': 'INTERVAL', 'interval_seconds': seconds})
        self.assertEqual(validate_proposal({**base, 'trigger_type': 'INTERVAL', 'interval_seconds': 60})['interval_seconds'], 60)

    @patch('langgraph_integration.views.check_project_permission', return_value=True)
    def test_ai_cannot_activate_or_choose_targets(self, project):
        model = Mock()
        proposal = {'name': '回归', 'trigger_type': 'CRON', 'cron_expression': '0 0 * * 1-5', 'status': 'ACTIVE', 'device_id': 999}
        model.invoke.return_value = SimpleNamespace(content=json.dumps(proposal))
        with patch('langgraph_integration.task_planning.get_user_active_llm_config', return_value=SimpleNamespace(name='model')), patch('langgraph_integration.views.create_llm_instance', return_value=model), patch('langgraph_integration.task_planning.record_llm_token_usage'):
            response = self.request()
            self.assertEqual(response.status_code, 200)
            self.assertNotIn('status', response.data['data'])
            self.assertNotIn('device_id', response.data['data'])
            model.bind_tools.assert_not_called()
