import os
import tempfile
import threading
import time
from pathlib import Path

import httpx
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import filters, status
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from projects.models import Project
from wharttest_django.viewsets import BaseModelViewSet

from .import_service import process_document_import
from .models import ApiCollection, ApiEnvironment, ApiExecutionRecord, ApiImportJob, ApiRequest, ApiTestCase
from .serializers import (
    ApiCollectionSerializer,
    ApiEnvironmentSerializer,
    ApiExecutionRecordSerializer,
    ApiImportJobSerializer,
    ApiRequestSerializer,
    ApiTestCaseSerializer,
)
from .services import VariableResolver, build_request_url, evaluate_assertions


def get_accessible_projects(user):
    if user.is_superuser:
        return Project.objects.all()
    return Project.objects.filter(Q(members__user=user) | Q(creator=user)).distinct()


def collect_collection_ids(root_collection: ApiCollection) -> list[int]:
    collection_ids = [root_collection.id]
    child_ids = list(root_collection.children.values_list("id", flat=True))
    for child_id in child_ids:
        child = root_collection.children.model.objects.get(id=child_id)
        collection_ids.extend(collect_collection_ids(child))
    return collection_ids


def _save_job(job_id: int, **fields):
    job = ApiImportJob.objects.get(pk=job_id)
    for key, value in fields.items():
        setattr(job, key, value)
    job.updated_at = timezone.now()
    job.save()


def _run_import_job(job_id: int, file_path: str):
    try:
        job = ApiImportJob.objects.select_related("collection", "project", "creator").get(pk=job_id)
        _save_job(
            job_id,
            status="running",
            progress_percent=8,
            progress_stage="queued",
            progress_message="任务已开始，正在准备解析接口文档。",
            error_message="",
        )

        def progress(percent: int, stage: str, message: str):
            _save_job(
                job_id,
                status="running",
                progress_percent=max(0, min(percent, 100)),
                progress_stage=stage,
                progress_message=message,
            )

        payload = process_document_import(
            collection=job.collection,
            user=job.creator,
            file_path=file_path,
            generate_test_cases=job.generate_test_cases,
            enable_ai_parse=job.enable_ai_parse,
            progress_callback=progress,
        )
        _save_job(
            job_id,
            status="success",
            progress_percent=100,
            progress_stage="completed",
            progress_message="接口文档解析完成。",
            result_payload=payload,
            error_message="",
            completed_at=timezone.now(),
        )
    except Exception as exc:  # noqa: BLE001
        _save_job(
            job_id,
            status="failed",
            progress_stage="failed",
            progress_message="接口文档解析失败。",
            error_message=str(exc),
            completed_at=timezone.now(),
        )
    finally:
        if os.path.exists(file_path):
            os.unlink(file_path)


def _start_import_job(job_id: int, file_path: str):
    worker = threading.Thread(target=_run_import_job, args=(job_id, file_path), daemon=True)
    worker.start()


class ApiCollectionViewSet(BaseModelViewSet):
    queryset = ApiCollection.objects.select_related("project", "parent", "creator")
    serializer_class = ApiCollectionSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name"]
    ordering_fields = ["order", "created_at", "name"]
    ordering = ["order", "created_at"]

    def get_queryset(self):
        queryset = super().get_queryset().filter(project__in=get_accessible_projects(self.request.user))
        project_id = self.request.query_params.get("project")
        parent_id = self.request.query_params.get("parent")
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if parent_id is not None:
            queryset = queryset.filter(parent_id=parent_id or None)
        return queryset

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)

    @action(detail=False, methods=["get"])
    def tree(self, request):
        project_id = request.query_params.get("project")
        if not project_id:
            return Response({"error": "project 参数必填"}, status=status.HTTP_400_BAD_REQUEST)
        queryset = self.get_queryset().filter(project_id=project_id, parent__isnull=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class ApiImportJobViewSet(BaseModelViewSet):
    queryset = ApiImportJob.objects.select_related("project", "collection", "creator")
    serializer_class = ApiImportJobSerializer
    http_method_names = ["get", "head", "options"]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["source_name", "progress_message", "error_message"]
    ordering_fields = ["created_at", "updated_at", "completed_at", "progress_percent"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset().filter(project__in=get_accessible_projects(self.request.user))
        if not self.request.user.is_superuser:
            queryset = queryset.filter(creator=self.request.user)

        project_id = self.request.query_params.get("project")
        status_value = self.request.query_params.get("status")
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if status_value:
            queryset = queryset.filter(status=status_value)
        return queryset


class ApiRequestViewSet(BaseModelViewSet):
    queryset = ApiRequest.objects.select_related("collection", "collection__project", "created_by")
    serializer_class = ApiRequestSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "url", "description"]
    ordering_fields = ["order", "created_at", "updated_at", "name"]
    ordering = ["order", "created_at"]

    def get_queryset(self):
        queryset = super().get_queryset().filter(collection__project__in=get_accessible_projects(self.request.user))
        project_id = self.request.query_params.get("project")
        collection_id = self.request.query_params.get("collection")
        method = self.request.query_params.get("method")
        if project_id:
            queryset = queryset.filter(collection__project_id=project_id)
        if collection_id:
            root_collection = ApiCollection.objects.filter(
                pk=collection_id,
                project__in=get_accessible_projects(self.request.user),
            ).first()
            if root_collection:
                queryset = queryset.filter(collection_id__in=collect_collection_ids(root_collection))
            else:
                queryset = queryset.none()
        if method:
            queryset = queryset.filter(method=method.upper())
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def create(self, request, *args, **kwargs):
        collection_id = request.data.get("collection")
        method = str(request.data.get("method") or "").upper().strip()
        url = str(request.data.get("url") or "").strip()
        if collection_id and method and url:
            collection = ApiCollection.objects.filter(
                pk=collection_id,
                project__in=get_accessible_projects(request.user),
            ).first()
            if collection:
                existing = (
                    ApiRequest.objects.filter(
                        collection__project=collection.project,
                        method=method,
                        url=url,
                    )
                    .select_related("collection", "collection__project", "created_by")
                    .first()
                )
                if existing:
                    serializer = self.get_serializer(existing)
                    return Response(serializer.data, status=status.HTTP_200_OK)
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser], url_path="import-document")
    def import_document(self, request):
        file = request.FILES.get("file")
        collection_id = request.data.get("collection_id")

        if not file:
            return Response({"error": "请上传接口文档文件"}, status=status.HTTP_400_BAD_REQUEST)
        if not collection_id:
            return Response({"error": "collection_id 参数必填"}, status=status.HTTP_400_BAD_REQUEST)

        collection = get_object_or_404(
            ApiCollection.objects.filter(project__in=get_accessible_projects(request.user)),
            pk=collection_id,
        )
        generate_test_cases = str(request.data.get("generate_test_cases", "true")).lower() in {"1", "true", "yes", "on"}
        enable_ai_parse = str(request.data.get("enable_ai_parse", "true")).lower() in {"1", "true", "yes", "on"}
        async_mode = str(request.data.get("async_mode", "true")).lower() in {"1", "true", "yes", "on"}

        suffix = Path(file.name).suffix or ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            for chunk in file.chunks():
                temp_file.write(chunk)
            temp_path = temp_file.name

        if async_mode:
            job = ApiImportJob.objects.create(
                project=collection.project,
                collection=collection,
                creator=request.user,
                source_name=file.name,
                status="pending",
                progress_percent=4,
                progress_stage="uploaded",
                progress_message="文档已上传，正在进入后台解析队列。",
                generate_test_cases=generate_test_cases,
                enable_ai_parse=enable_ai_parse,
            )
            _start_import_job(job.id, temp_path)
            serializer = ApiImportJobSerializer(job)
            return Response(serializer.data, status=status.HTTP_202_ACCEPTED)

        try:
            payload = process_document_import(
                collection=collection,
                user=request.user,
                file_path=temp_path,
                generate_test_cases=generate_test_cases,
                enable_ai_parse=enable_ai_parse,
            )
            return Response(payload, status=status.HTTP_201_CREATED)
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)

    @action(detail=True, methods=["post"])
    def execute(self, request, pk=None):
        api_request = self.get_object()
        project = api_request.collection.project

        environment = None
        environment_id = request.data.get("environment_id")
        if environment_id:
            environment = ApiEnvironment.objects.filter(project=project, pk=environment_id).first()
        if environment is None:
            environment = ApiEnvironment.objects.filter(project=project, is_default=True).first()

        variables = {}
        base_url = ""
        common_headers = {}
        timeout_ms = api_request.timeout_ms

        if environment:
            variables.update(environment.variables or {})
            base_url = environment.base_url or ""
            common_headers = environment.common_headers or {}
            timeout_ms = environment.timeout_ms or timeout_ms

        resolver = VariableResolver(variables)

        resolved_url = build_request_url(base_url, str(resolver.resolve(api_request.url)))
        resolved_headers = {
            **resolver.resolve(common_headers or {}),
            **resolver.resolve(api_request.headers or {}),
        }
        resolved_params = resolver.resolve(api_request.params or {})
        resolved_body = resolver.resolve(api_request.body)

        request_kwargs = {
            "method": api_request.method,
            "url": resolved_url,
            "headers": resolved_headers,
            "params": resolved_params,
            "timeout": max(timeout_ms / 1000, 1),
            "follow_redirects": True,
        }

        if api_request.body_type == "json":
            request_kwargs["json"] = resolved_body or {}
        elif api_request.body_type == "form":
            request_kwargs["data"] = resolved_body or {}
        elif api_request.body_type == "raw":
            request_kwargs["content"] = resolved_body if isinstance(resolved_body, str) else str(resolved_body)

        request_snapshot = {
            "method": api_request.method,
            "url": resolved_url,
            "headers": resolved_headers,
            "params": resolved_params,
            "body_type": api_request.body_type,
            "body": resolved_body,
        }

        response_snapshot = {}
        status_code = None
        response_time = None
        assertions_results = []
        passed = False
        execute_status = "error"
        error_message = ""

        try:
            started_at = time.perf_counter()
            response = httpx.request(**request_kwargs)
            response_time = round((time.perf_counter() - started_at) * 1000, 2)
            status_code = response.status_code
            try:
                response_payload = response.json()
            except ValueError:
                response_payload = response.text

            response_snapshot = {
                "headers": dict(response.headers),
                "body": response_payload,
            }

            assertions_results, passed = evaluate_assertions(
                api_request.assertions or [],
                response.status_code,
                response.text,
                response_payload if isinstance(response_payload, (dict, list)) else None,
            )
            if not assertions_results:
                passed = response.is_success

            execute_status = "success" if passed else "failed"
        except Exception as exc:  # noqa: BLE001
            error_message = str(exc)
            response_snapshot = {"body": None}
            passed = False
            execute_status = "error"

        record = ApiExecutionRecord.objects.create(
            project=project,
            request=api_request,
            environment=environment,
            request_name=api_request.name,
            method=api_request.method,
            url=resolved_url,
            status=execute_status,
            passed=passed,
            status_code=status_code,
            response_time=response_time,
            request_snapshot=request_snapshot,
            response_snapshot=response_snapshot,
            assertions_results=assertions_results,
            error_message=error_message,
            executor=request.user,
        )

        serializer = ApiExecutionRecordSerializer(record)
        return Response(serializer.data)


class ApiEnvironmentViewSet(BaseModelViewSet):
    queryset = ApiEnvironment.objects.select_related("project", "creator")
    serializer_class = ApiEnvironmentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "base_url"]
    ordering_fields = ["created_at", "updated_at", "name"]
    ordering = ["-is_default", "name"]

    def get_queryset(self):
        queryset = super().get_queryset().filter(project__in=get_accessible_projects(self.request.user))
        project_id = self.request.query_params.get("project")
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)


class ApiExecutionRecordViewSet(BaseModelViewSet):
    queryset = ApiExecutionRecord.objects.select_related("project", "request", "environment", "executor")
    serializer_class = ApiExecutionRecordSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["request_name", "url", "error_message"]
    ordering_fields = ["created_at", "response_time", "status_code"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset().filter(project__in=get_accessible_projects(self.request.user))
        project_id = self.request.query_params.get("project")
        request_id = self.request.query_params.get("request")
        collection_id = self.request.query_params.get("collection")
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if request_id:
            queryset = queryset.filter(request_id=request_id)
        if collection_id:
            root_collection = ApiCollection.objects.filter(
                pk=collection_id,
                project__in=get_accessible_projects(self.request.user),
            ).first()
            if root_collection:
                queryset = queryset.filter(request__collection_id__in=collect_collection_ids(root_collection))
            else:
                queryset = queryset.none()
        return queryset


class ApiTestCaseViewSet(BaseModelViewSet):
    queryset = ApiTestCase.objects.select_related("project", "request", "creator")
    serializer_class = ApiTestCaseSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["created_at", "updated_at", "name"]
    ordering = ["-created_at"]

    def get_queryset(self):
        queryset = super().get_queryset().filter(project__in=get_accessible_projects(self.request.user))
        project_id = self.request.query_params.get("project")
        request_id = self.request.query_params.get("request")
        collection_id = self.request.query_params.get("collection")
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if request_id:
            queryset = queryset.filter(request_id=request_id)
        if collection_id:
            root_collection = ApiCollection.objects.filter(
                pk=collection_id,
                project__in=get_accessible_projects(self.request.user),
            ).first()
            if root_collection:
                queryset = queryset.filter(request__collection_id__in=collect_collection_ids(root_collection))
            else:
                queryset = queryset.none()
        return queryset

    def perform_create(self, serializer):
        serializer.save(creator=self.request.user)
