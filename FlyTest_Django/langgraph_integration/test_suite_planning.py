from types import SimpleNamespace
from unittest.mock import Mock, patch
from django.contrib.auth.models import User
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate
from .suite_planning import SuitePlanningAPIView


class SuitePlanningTests(SimpleTestCase):
    def setUp(self):
        self.user = User(username="suite-review", is_superuser=True, is_active=True)
        self.payload = {"project_id": 1, "prompt": "登录冒烟", "cases": [{"id": 1, "name": "登录", "tags": ["smoke"]}]}

    def request(self, authenticated=True):
        request = APIRequestFactory().post("/lg/suite-planning/", self.payload, format="json")
        if authenticated:
            force_authenticate(request, self.user)
        return SuitePlanningAPIView.as_view()(request)

    def test_auth_and_project_scope(self):
        self.assertIn(self.request(False).status_code, [401, 403])
        with patch("langgraph_integration.views.check_project_permission", return_value=None):
            self.assertEqual(self.request().status_code, 403)

    @patch("langgraph_integration.views.check_project_permission", return_value=True)
    def test_no_model(self, project):
        with patch("langgraph_integration.suite_planning.get_user_active_llm_config", return_value=None):
            self.assertEqual(self.request().status_code, 503)

    @patch("langgraph_integration.views.check_project_permission", return_value=True)
    def test_output_ids_are_bounded_and_tools_are_not_bound(self, project):
        model = Mock()
        config = SimpleNamespace(name="model")
        with patch("langgraph_integration.suite_planning.get_user_active_llm_config", return_value=config), patch("langgraph_integration.views.create_llm_instance", return_value=model), patch("langgraph_integration.suite_planning.record_llm_token_usage"):
            model.invoke.return_value = SimpleNamespace(content='{"name":"建议套件","test_case_ids":[1,1]}')
            response = self.request()
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["data"]["test_case_ids"], [1])
            model.bind_tools.assert_not_called()
            model.invoke.return_value = SimpleNamespace(content='{"test_case_ids":[999]}')
            self.assertEqual(self.request().status_code, 502)

    @patch("langgraph_integration.views.check_project_permission", return_value=True)
    def test_candidate_limit(self, project):
        self.payload["cases"] *= 201
        self.assertEqual(self.request().status_code, 400)
