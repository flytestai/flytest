from django.test import SimpleTestCase

from testcases.filters import TestCaseFilter
from testcases.models import TestCase


class ExecutionStatusFilterTests(SimpleTestCase):
    """Validate filter SQL without creating or changing application data."""

    def test_execution_status_is_applied_to_query(self):
        for status, _label in TestCase.EXECUTION_STATUS_CHOICES:
            with self.subTest(status=status):
                filtered = TestCaseFilter({"execution_status": status}, queryset=TestCase.objects.all())
                self.assertTrue(filtered.is_valid(), filtered.errors)
                sql, params = filtered.qs.query.sql_with_params()
                self.assertIn("execution_status", sql)
                self.assertIn(status, params)

    def test_unknown_status_is_rejected(self):
        filtered = TestCaseFilter({"execution_status": "unsupported"}, queryset=TestCase.objects.all())
        self.assertFalse(filtered.is_valid())
        self.assertIn("execution_status", filtered.errors)
