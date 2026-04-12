from celery import shared_task

from .ai_mode_runtime import run_ai_execution


@shared_task(bind=True, name="ui_automation.execute_ai_record")
def execute_ui_ai_record(self, record_id: int) -> None:
    """通过 Celery 执行 UI 智能模式任务。"""
    run_ai_execution(record_id, worker_token=f"celery:{self.request.id}")
