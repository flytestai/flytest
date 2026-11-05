"""Read-only workspace aggregates over an already permission-scoped queryset."""
from datetime import timedelta
from django.db.models import Count, Q, Exists, OuterRef
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from .models import Document, DocumentChunk, QueryLog


def workspace_queryset(queryset, params):
    queryset = queryset.select_related('project', 'creator').annotate(
        processing_documents=Count('documents', filter=Q(documents__status__in=['pending', 'processing']), distinct=True),
        total_documents=Count('documents', distinct=True),
        total_chunks=Count('documents__chunks', distinct=True),
    )
    state = params.get('workspace_state')
    if state == 'processing':
        queryset = queryset.filter(is_active=True, processing_documents__gt=0)
    elif state == 'active':
        queryset = queryset.filter(is_active=True, processing_documents=0)
    elif state == 'disabled':
        queryset = queryset.filter(is_active=False)
    source = params.get('access_type')
    if source in ['file', 'url', 'text']:
        docs = Document.objects.filter(knowledge_base_id=OuterRef('pk'))
        if source == 'url':
            docs = docs.filter(document_type='url')
        elif source == 'file':
            docs = docs.exclude(document_type='url').exclude(file='').filter(file__isnull=False)
        else:
            docs = docs.exclude(document_type='url').filter(Q(file='') | Q(file__isnull=True))
        queryset = queryset.filter(Exists(docs))
    return queryset


def workspace_summary(queryset, project):
    # Deliberately independent of list search, state, access type and pagination.
    if project:
        try:
            project_id = int(project)
        except (ValueError, TypeError):
            raise ValidationError({'project': '项目编号必须为整数'})
        queryset = queryset.filter(project_id=project_id)
    ids = queryset.values('pk')
    docs = Document.objects.filter(knowledge_base_id__in=ids)
    chunks = DocumentChunk.objects.filter(document__knowledge_base_id__in=ids)
    logs = QueryLog.objects.filter(knowledge_base_id__in=ids)
    now = timezone.now()
    month_start = timezone.localtime(now).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    source_counts = docs.aggregate(
        uploaded=Count('pk', filter=~Q(file='') & Q(file__isnull=False) & ~Q(document_type='url')),
        linked=Count('pk', filter=Q(document_type='url')),
        pasted=Count('pk', filter=~Q(document_type='url') & (Q(file='') | Q(file__isnull=True))),
    )
    processing_ids = docs.filter(status__in=['pending', 'processing']).values('knowledge_base_id')
    return {
        'knowledge_bases': queryset.count(), 'documents': docs.count(),
        'indexed_chunks': chunks.exclude(vector_id='').filter(vector_id__isnull=False).count(),
        'monthly_queries': logs.filter(created_at__gte=month_start).count(),
        'states': {
            'active': queryset.filter(is_active=True).exclude(pk__in=processing_ids).count(),
            'processing': queryset.filter(is_active=True, pk__in=processing_ids).count(),
            'disabled': queryset.filter(is_active=False).count(),
        },
        'sources': {'file': source_counts['uploaded'], 'url': source_counts['linked'], 'text': source_counts['pasted']},
        'hot_queries': list(logs.filter(created_at__gte=now-timedelta(days=30)).exclude(query='').order_by()
                            .values('query').annotate(count=Count('pk')).order_by('-count', 'query')[:5]),
    }
