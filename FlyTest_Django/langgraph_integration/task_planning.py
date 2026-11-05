"""Read-only schedule proposals; never create, activate or execute tasks."""
import copy
import json
import re
from langchain_core.messages import HumanMessage, SystemMessage
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import get_user_active_llm_config, extract_llm_usage_metrics, record_llm_token_usage


def validate_proposal(value):
    if not isinstance(value, dict) or value.get('trigger_type') not in ('CRON', 'INTERVAL'):
        raise ValueError('unsupported schedule')
    name = value.get('name')
    if not isinstance(name, str) or not name.strip():
        raise ValueError('missing name')
    cron = value.get('cron_expression', '')
    interval = value.get('interval_seconds', 3600)
    if value['trigger_type'] == 'CRON':
        # Deliberately accept only portable numeric five-field cron proposals.
        # Full calendar validation remains with the scheduler when the human saves.
        if not isinstance(cron, str) or len(cron) > 100 or len(cron.split()) != 5:
            raise ValueError('five cron fields required')
        for field, limit in zip(cron.split(), (59, 23, 31, 12, 6)):
            if not re.fullmatch(r'[\d*/,\-]+', field):
                raise ValueError('invalid cron syntax')
            for piece in field.split(','):
                match = re.fullmatch(r'(\*|\d+(?:-\d+)?)(?:/(\d+))?', piece)
                if not match or (match[2] is not None and not 1 <= int(match[2]) <= limit + 1):
                    raise ValueError('invalid cron step')
                if match[1] != '*':
                    numbers = [int(n) for n in match[1].split('-')]
                    minimum = 1 if limit in (31, 12) else 0
                    if any(not minimum <= n <= limit for n in numbers) or numbers != sorted(numbers):
                        raise ValueError('invalid cron range')
        cron = ' '.join(cron.split())
        interval = 3600
    elif type(interval) is not int or not 60 <= interval <= 86400:
        raise ValueError('interval out of bounds')
    return {'name': name.strip()[:200], 'description': str(value.get('description', ''))[:2000], 'trigger_type': value['trigger_type'], 'cron_expression': cron if value['trigger_type'] == 'CRON' else '', 'interval_seconds': interval}


class TaskPlanningAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .views import check_project_permission, create_llm_instance, _extract_llm_response_text
        if not request.user.has_perm('app_automation.view_appautomationscheduledtask'):
            return Response({'message': '没有定时任务权限'}, status=403)
        try:
            project_id = int(request.data.get('project_id', 0))
        except (ValueError, TypeError):
            return Response({'message': '项目参数无效'}, status=400)
        if not check_project_permission(request.user, project_id):
            return Response({'message': '没有当前项目访问权限'}, status=403)
        prompt = request.data.get('prompt')
        if not isinstance(prompt, str) or not 1 <= len(prompt.strip()) <= 2000:
            return Response({'message': '请输入 1–2000 字的任务目标'}, status=400)
        config = get_user_active_llm_config(request.user)
        if not config:
            return Response({'message': '请先配置并激活 AI 模型'}, status=503)
        try:
            limited = copy.copy(config)
            limited.request_timeout, limited.max_retries = 45, 1
            model = create_llm_instance(limited, temperature=0)
            response = model.invoke([SystemMessage(content='你是调度建议助手，不调用工具，不创建任务。仅支持 CRON 五段（分 时 日 月 周，数字范围或通配符）或 INTERVAL 60–86400 整秒。所有 Cron 使用 UTC，用户未注明时区时按 Asia/Shanghai 转换。不得输出 Quartz 六段。只返回 JSON {"name":"名称","description":"说明原时区与 UTC 转换","trigger_type":"CRON","cron_expression":"0 0 * * 1-5","interval_seconds":3600}。不返回设备、目标或启用状态。'), HumanMessage(content=prompt)])
            record_llm_token_usage(user=request.user, llm_config=config, source='other', metadata={'action': 'app_task_planning', 'project_id': project_id}, **extract_llm_usage_metrics(response))
            value = json.loads(re.sub(r'^```(?:json)?\s*|\s*```$', '', _extract_llm_response_text(response).strip()))
            proposal = validate_proposal(value)
        except Exception:
            return Response({'message': '未生成有效调度规则，请调整描述后重试'}, status=502)
        return Response({'status': 'success', 'success': True, 'data': proposal})
