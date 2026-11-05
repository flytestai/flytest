from datetime import timedelta
from django.contrib.auth.models import User, Permission
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate
from projects.models import Project, ProjectMember
from .models import KnowledgeBase, Document, DocumentChunk, QueryLog
from .views import KnowledgeBaseViewSet


class KnowledgeWorkspaceTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user('knowledge-reviewer', is_staff=True)
        self.user.user_permissions.add(Permission.objects.get(codename='view_knowledgebase'))
        self.project = Project.objects.create(name='Visible project')
        self.hidden = Project.objects.create(name='Hidden project')
        ProjectMember.objects.create(project=self.project, user=self.user)
        self.kb = KnowledgeBase.objects.create(name='Visible knowledge', project=self.project)
        self.disabled = KnowledgeBase.objects.create(name='Disabled knowledge', project=self.project, is_active=False)
        self.other = KnowledgeBase.objects.create(name='Secret knowledge', project=self.hidden)
        self.file = Document.objects.create(knowledge_base=self.kb, title='File', document_type='pdf', file='test.pdf', status='completed')
        self.url = Document.objects.create(knowledge_base=self.kb, title='Link', document_type='url', status='processing')
        self.text = Document.objects.create(knowledge_base=self.disabled, title='Text', document_type='txt', status='pending')
        Document.objects.create(knowledge_base=self.other, title='Secret file', document_type='txt')
        DocumentChunk.objects.create(document=self.file, chunk_index=0, content='Indexed', vector_id='v1')
        DocumentChunk.objects.create(document=self.file, chunk_index=1, content='Unindexed', vector_id='')
        DocumentChunk.objects.create(document=self.file, chunk_index=2, content='Unindexed null')
        QueryLog.objects.create(knowledge_base=self.kb, query='登录鉴权')
        QueryLog.objects.create(knowledge_base=self.kb, query='登录鉴权')
        old = QueryLog.objects.create(knowledge_base=self.kb, query='旧记录')
        QueryLog.objects.filter(pk=old.pk).update(created_at=timezone.now()-timedelta(days=60))
        QueryLog.objects.create(knowledge_base=self.other, query='Secret query')

    def call(self, action='workspace', params=None, user=True):
        request = APIRequestFactory().get('/knowledge/knowledge-bases/', params or {})
        if user:
            force_authenticate(request, user=self.user)
        return KnowledgeBaseViewSet.as_view({'get': action})(request)

    def test_summary_scope_and_actual_index_counts(self):
        response = self.call(params={'project': self.project.pk, 'search': 'missing', 'page': 999})
        self.assertEqual(response.status_code, 200)
        data = response.data
        self.assertEqual(data['knowledge_bases'], 2)
        self.assertEqual(data['documents'], 3)
        self.assertEqual(data['indexed_chunks'], 1)
        self.assertEqual(data['monthly_queries'], 2)
        self.assertEqual(data['sources'], {'file': 1, 'url': 1, 'text': 1})
        self.assertEqual(data['states'], {'active': 0, 'processing': 1, 'disabled': 1})
        self.assertEqual(data['hot_queries'], [{'query': '登录鉴权', 'count': 2}])

    def test_unauthorized_project_has_no_aggregate_leak(self):
        data = self.call(params={'project': self.hidden.pk}).data
        self.assertEqual(data['documents'], 0)
        self.assertEqual(data['monthly_queries'], 0)
        self.assertEqual(data['hot_queries'], [])
        self.assertEqual(self.call(user=False).status_code, 401)
        self.assertEqual(self.call(params={'project': 'invalid'}).status_code, 400)

    def test_server_filters_and_annotation_do_not_multiply_counts(self):
        response = self.call('list', {'project': self.project.pk, 'workspace_state': 'processing', 'access_type': 'file'})
        data = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['document_count'], 2)
        self.assertEqual(data[0]['chunk_count'], 3)
        self.assertEqual(data[0]['processing_documents'], 1)
        response = self.call('list', {'workspace_state': 'disabled', 'access_type': 'text'})
        data = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual([row['id'] for row in data], [str(self.disabled.pk)])

    def test_statistics_requires_model_permission(self):
        self.user.user_permissions.clear()
        # Prevent the project-member shortcut from masking the model permission check.
        ProjectMember.objects.filter(user=self.user).delete()
        self.assertEqual(self.call().status_code, 403)
