from __future__ import annotations

from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate
from datetime import timedelta

from projects.models import Project
from requirements.models import RequirementDocument, RequirementModule, ReviewReport
from requirements.services import RequirementReviewEngine, safe_llm_invoke_v2
from requirements.serializers import ReviewReportSerializer
from requirements.views import RequirementDocumentViewSet


class RequirementReviewFallbackTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = User.objects.create_superuser(
            username="admin",
            email="admin@example.com",
            password="password123",
        )
        self.project = Project.objects.create(
            name="Requirement Review Test Project",
            description="",
            creator=self.user,
        )
        self.document = RequirementDocument.objects.create(
            project=self.project,
            title="Sample Requirement",
            description="",
            document_type="txt",
            content="登录功能需求说明",
            status="review_completed",
            uploader=self.user,
        )
        self.factory = APIRequestFactory()

    def test_restart_review_falls_back_immediately_when_celery_is_unavailable(self) -> None:
        request = self.factory.post(
            f"/api/requirements/documents/{self.document.id}/restart-review/",
            {
                "analysis_type": "comprehensive",
                "parallel_processing": True,
                "max_workers": 3,
            },
            format="json",
        )
        force_authenticate(request, user=self.user)
        view = RequirementDocumentViewSet.as_view({"post": "restart_review"})

        with patch(
            "requirements.views._can_dispatch_requirement_review_task",
            return_value=(False, "broker unavailable: redis://localhost:6379/0"),
        ), patch(
            "requirements.tasks.start_local_requirement_review"
        ) as mock_local_start, patch(
            "requirements.tasks.execute_requirement_review.delay"
        ) as mock_delay:
            response = view(request, pk=str(self.document.id))

        self.document.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["execution_mode"], "local_async_fallback")
        self.assertEqual(self.document.status, "reviewing")
        mock_delay.assert_not_called()
        mock_local_start.assert_called_once()

    def test_retrieve_recovers_stale_review_as_failed(self) -> None:
        self.document.status = "reviewing"
        self.document.save(update_fields=["status", "updated_at"])
        review_report = ReviewReport.objects.create(
            document=self.document,
            review_type="comprehensive",
            status="in_progress",
            progress=0.725,
            current_step="逻辑性分析完成",
        )
        stale_at = timezone.now() - timedelta(minutes=20)
        ReviewReport.objects.filter(pk=review_report.pk).update(updated_at=stale_at)

        request = self.factory.get(
            f"/api/requirements/documents/{self.document.id}/"
        )
        force_authenticate(request, user=self.user)
        view = RequirementDocumentViewSet.as_view({"get": "retrieve"})

        response = view(request, pk=str(self.document.id))

        self.document.refresh_from_db()
        review_report.refresh_from_db()

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(self.document.status, "failed")
        self.assertEqual(review_report.status, "failed")
        self.assertIn("中断", review_report.current_step)
        self.assertEqual(response.data["status"], "failed")
        self.assertEqual(response.data["latest_review"]["status"], "failed")

    def test_default_analysis_result_contains_readable_feedback(self) -> None:
        with patch(
            "requirements.services.RequirementReviewEngine._get_llm_instance",
            return_value=object(),
        ):
            engine = RequirementReviewEngine(user=self.user)

        result = engine._get_default_analysis_result(
            "logic_analysis", fallback_reason="mock timeout"
        )

        self.assertTrue(result["degraded"])
        self.assertTrue(result["summary"])
        self.assertTrue(result["recommendations"])
        self.assertTrue(result["weaknesses"])
        self.assertEqual(result["error_reason"], "mock timeout")

    def test_completeness_default_analysis_uses_document_heuristics(self) -> None:
        with patch(
            "requirements.services.RequirementReviewEngine._get_llm_instance",
            return_value=object(),
        ):
            engine = RequirementReviewEngine(user=self.user)

        result = engine._get_default_analysis_result(
            "completeness_analysis",
            fallback_reason="LLM returned empty response",
            source_content="用户可以使用手机号和验证码登录系统，验证码错误时需要提示错误并支持重新发送。",
        )

        self.assertTrue(result["issues"])
        self.assertIn("降级为基于文档内容的补充检查", result["summary"])
        self.assertTrue(result["recommendations"])
        self.assertTrue(result["weaknesses"])

    def test_safe_llm_invoke_v2_supports_structured_content_blocks(self) -> None:
        class DummyLLM:
            def invoke(self, _messages):
                return type(
                    "DummyResponse",
                    (),
                    {
                        "content": [{"text": '{"overall_score": 88, "issues": []}'}],
                        "response_metadata": {},
                        "usage_metadata": {},
                        "additional_kwargs": {},
                    },
                )()

        response = safe_llm_invoke_v2(DummyLLM(), ["ping"])

        self.assertEqual(response.content, '{"overall_score": 88, "issues": []}')

    def test_generate_comprehensive_report_v2_keeps_feedback_when_analyses_degrade(self) -> None:
        RequirementModule.objects.create(
            document=self.document,
            title="登录模块",
            content="用户登录与注册规则",
            order=1,
        )

        with patch(
            "requirements.services.RequirementReviewEngine._get_llm_instance",
            return_value=object(),
        ):
            engine = RequirementReviewEngine(user=self.user)

        degraded_result = engine._get_default_analysis_result("clarity_analysis")
        report = engine._generate_comprehensive_report_v2(
            {
                "completeness": engine._get_default_analysis_result(
                    "completeness_analysis"
                ),
                "consistency": engine._get_default_analysis_result(
                    "consistency_analysis"
                ),
                "testability": engine._get_default_analysis_result(
                    "testability_analysis"
                ),
                "feasibility": engine._get_default_analysis_result(
                    "feasibility_analysis"
                ),
                "clarity": degraded_result,
                "logic": engine._get_default_analysis_result("logic_analysis"),
                "document": self.document,
            }
        )

        self.assertTrue(report["recommendations"])
        self.assertTrue(report["summary"])
        self.assertIn("降级", report["summary"])
        self.assertTrue(report["degraded_analyses"])
        self.assertTrue(report["module_analyses"])
        self.assertTrue(report["module_analyses"][0]["recommendations"])

    def test_review_report_serializer_enriches_legacy_empty_feedback(self) -> None:
        RequirementModule.objects.create(
            document=self.document,
            title="登录模块",
            content="用户登录与注册规则",
            order=1,
        )
        report = ReviewReport.objects.create(
            document=self.document,
            review_type="comprehensive",
            status="completed",
            completion_score=70,
            summary="需求文档整体质量一般（评分：70/100）。未发现明显问题，质量较高。",
            recommendations="",
            specialized_analyses={
                "logic_analysis": {
                    "analysis_type": "logic_analysis",
                    "overall_score": 70,
                    "summary": "logic_analysis分析完成，整体质量中等",
                    "issues": [],
                }
            },
        )

        serialized = ReviewReportSerializer(report).data

        self.assertTrue(serialized["recommendations"])
        self.assertIn("降级", serialized["summary"])
        self.assertTrue(
            serialized["specialized_analyses"]["logic_analysis"]["recommendations"]
        )
        self.assertTrue(serialized["module_results"])
        self.assertEqual(serialized["module_results"][0]["module_name"], "登录模块")
        self.assertTrue(serialized["module_results"][0]["recommendations"])
