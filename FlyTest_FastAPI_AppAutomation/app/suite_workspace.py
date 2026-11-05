"""Suite presentation metadata and device-isolated parallel queues. No schema migration."""
import json
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from . import database
from .access_control import ensure_project_access

router = APIRouter(prefix="/test-suites")
_lock = threading.RLock()


def metadata_path(row):
    return database.UPLOADS_DIR / "suite-metadata" / str(int(row["project_id"])) / f'{int(row["id"])}.json'


def read_metadata(row):
    with _lock:
        path = metadata_path(row)
        if not path.exists():
            return {"group": "", "execution_strategy": "sequential"}
        return json.loads(path.read_text(encoding="utf-8"))


def write_metadata(row, group, strategy):
    with _lock:
        path = metadata_path(row)
        path.parent.mkdir(parents=True, exist_ok=True)
        pending = path.with_suffix(f".{uuid.uuid4().hex}.tmp")
        pending.write_text(json.dumps({"group": group, "execution_strategy": strategy}, ensure_ascii=False), encoding="utf-8")
        pending.replace(path)


@router.get("/capabilities/")
def capabilities():
    return {"success": True, "data": {"metadata": True, "parallel": True, "max_devices": 8}}


class ParallelRunPayload(BaseModel):
    device_ids: list[int] = Field(min_length=2, max_length=8)
    package_name: str = Field(default="", max_length=255)
    triggered_by: str = Field(default="FeiCe", max_length=64)


def run_parallel_queues(suite_id, queues):
    from .extended_routes import run_suite_background
    with ThreadPoolExecutor(max_workers=len(queues)) as pool:
        futures = [pool.submit(run_suite_background, suite_id, queue) for queue in queues]
        for future in futures:
            future.result()


@router.post("/{suite_id}/run-parallel/")
def run_parallel(suite_id: int, payload: ParallelRunPayload):
    from .extended_routes import get_suite_or_404, get_package_override_or_404, create_execution, utc_now
    from .main import reserve_device_for_execution, finish_device_lock
    if len(set(payload.device_ids)) != len(payload.device_ids):
        raise HTTPException(400, "请选择不同的执行设备")
    queues = [[] for _ in payload.device_ids]
    ids, reserved = [], []
    previous = None
    committed = False
    try:
        with database.connection() as conn:
            suite = get_suite_or_404(conn, suite_id)
            ensure_project_access(suite["project_id"])
            if len(suite["suite_cases"]) < len(payload.device_ids):
                raise HTTPException(400, "用例数量不能少于执行设备数量")
            if suite["execution_status"] == "running":
                raise HTTPException(409, "套件正在执行")
            previous = (suite["execution_status"], suite["execution_result"])
            package = get_package_override_or_404(conn, suite["project_id"], package_name=payload.package_name)
            for device_id in sorted(payload.device_ids):
                device = database.fetch_one(conn, "SELECT * FROM devices WHERE id = ?", (device_id,))
                if not device:
                    raise HTTPException(404, "执行设备不存在")
                if device.get("status") not in {"available", "online"}:
                    raise HTTPException(409, "所选设备不可用或已被占用")
                specs = json.loads(device.get("device_specs") or "{}") if isinstance(device.get("device_specs"), str) else device.get("device_specs") or {}
                if str(specs.get("platform", "android")).lower() == "ios":
                    raise HTTPException(400, "当前执行器仅支持 Android")
                reserve_device_for_execution(conn, device_id, locked_by=payload.triggered_by)
                reserved.append(device_id)
            for index, member in enumerate(suite["suite_cases"]):
                slot = index % len(payload.device_ids)
                execution_id = create_execution(conn, suite["project_id"], member["test_case_id"], payload.device_ids[slot], payload.triggered_by, suite_id, package_id=package["id"] if package else None)
                queues[slot].append(execution_id)
                ids.append(execution_id)
            conn.execute("UPDATE test_suites SET execution_status='running', execution_result='', updated_at=? WHERE id=?", (utc_now(), suite_id))
        committed = True
        threading.Thread(target=run_parallel_queues, args=(suite_id, queues), daemon=True).start()
    except Exception:
        if not committed:
            raise
        # Transactions roll back reservation failures. Cleanup also covers thread startup failure.
        with database.connection() as conn:
            for execution_id in ids:
                conn.execute("DELETE FROM executions WHERE id=?", (execution_id,))
            for device_id in reserved:
                finish_device_lock(conn, device_id)
            if previous:
                conn.execute("UPDATE test_suites SET execution_status=?, execution_result=? WHERE id=?", (*previous, suite_id))
        raise
    return {"success": True, "data": {"suite_id": suite_id, "execution_ids": ids, "test_case_count": len(ids)}}
