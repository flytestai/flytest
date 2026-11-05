import base64
import io
import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

from PIL import Image
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from .element_recognition import ElementRecognitionAPIView, normalize_candidates


class ElementRecognitionTests(SimpleTestCase):
    def setUp(self):
        self.user = User(username="visual-review", is_superuser=True, is_active=True)
        self.factory = APIRequestFactory()
        self.config = SimpleNamespace(name="test-vision", supports_vision=True)

    def screenshot(self):
        image = io.BytesIO()
        Image.new("RGB", (16, 16)).save(image, format="PNG")
        return "data:image/png;base64," + base64.b64encode(image.getvalue()).decode()

    def request(self, payload=None, authenticated=True):
        request = self.factory.post("/api/lg/element-recognition/", payload or {"project_id": 1}, format="json")
        if authenticated:
            force_authenticate(request, self.user)
        return ElementRecognitionAPIView.as_view()(request)

    def test_candidate_coordinates_are_bounded_and_saved_only_after_review(self):
        data = {"elements": [{"name": "登录按钮", "control_type": "button", "x": 3, "y": 4}, {"name": "越界", "x": 20, "y": 2}, {"name": "布尔值", "x": True, "y": 2}]}
        result = normalize_candidates(json.dumps(data), 16, 16, 1, "登录注册")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["selector_type"], "pos")
        self.assertEqual(result[0]["config"]["review_status"], "pending")
        self.assertFalse(result[0]["is_active"])
        self.assertEqual(result[0]["config"]["page_name"], "登录注册")

    def test_authentication_and_project_scope_precede_model_call(self):
        self.assertIn(self.request(authenticated=False).status_code, [401, 403])
        with patch("langgraph_integration.views.check_project_permission", return_value=None), patch("langgraph_integration.views.create_llm_instance") as model:
            self.assertEqual(self.request().status_code, 403)
            model.assert_not_called()

    @patch("langgraph_integration.views.check_project_permission", return_value=object())
    def test_missing_vision_model_is_reported(self, project):
        with patch("langgraph_integration.element_recognition.get_user_active_llm_config", return_value=None):
            self.assertEqual(self.request().status_code, 503)

    @patch("langgraph_integration.views.check_project_permission", return_value=object())
    def test_invalid_screenshot_never_reaches_model(self, project):
        with patch("langgraph_integration.element_recognition.get_user_active_llm_config", return_value=self.config), patch("langgraph_integration.views.create_llm_instance") as model:
            self.assertEqual(self.request({"project_id": 1, "image": "https://example.test/image.png"}).status_code, 400)
            model.assert_not_called()

    @patch("langgraph_integration.views.check_project_permission", return_value=object())
    def test_visual_model_returns_candidates_without_tools_or_asset_writes(self, project):
        model = Mock()
        model.invoke.return_value = SimpleNamespace(content='{"elements":[{"name":"确认按钮","control_type":"button","x":8,"y":8}]}')
        with patch("langgraph_integration.element_recognition.get_user_active_llm_config", return_value=self.config), patch("langgraph_integration.views.create_llm_instance", return_value=model) as factory:
            response = self.request({"project_id": 1, "image": self.screenshot(), "page_name": "订单页"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]["elements"]), 1)
        self.assertFalse(response.data["data"]["elements"][0]["is_active"])
        model.bind_tools.assert_not_called()
        self.assertEqual(factory.call_args.kwargs["temperature"], 0)

    @patch("langgraph_integration.views.check_project_permission", return_value=object())
    def test_multipart_screenshot_and_usage_accounting(self, project):
        content = base64.b64decode(self.screenshot().split(",")[1])
        request = self.factory.post("/api/lg/element-recognition/", {"project_id": "1", "screenshot": SimpleUploadedFile("screen.png", content, content_type="image/png")}, format="multipart")
        force_authenticate(request, self.user)
        model = Mock()
        model.invoke.return_value = SimpleNamespace(content='{"elements":[]}', usage_metadata={"input_tokens": 10, "output_tokens": 5, "total_tokens": 15})
        with patch("langgraph_integration.element_recognition.get_user_active_llm_config", return_value=self.config), patch("langgraph_integration.views.create_llm_instance", return_value=model), patch("langgraph_integration.element_recognition.record_llm_token_usage") as usage:
            response = ElementRecognitionAPIView.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(usage.call_args.kwargs["total_tokens"], 15)
        self.assertEqual(usage.call_args.kwargs["metadata"]["action"], "app_element_recognition")
