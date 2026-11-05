"""Project environment profiles, without modifying global executor settings."""
import json
import socket
import threading
import uuid
from typing import Literal
from urllib.parse import urlsplit
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from . import database
from .access_control import ensure_project_access

router = APIRouter(prefix='/settings/environments')
_lock = threading.RLock()


class EnvironmentPayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    kind: Literal['device', 'service', 'cloud', 'dedicated'] = 'device'
    platform: Literal['android', 'ios', 'none'] = 'android'
    network: Literal['intranet', 'cloud', 'dedicated'] = 'intranet'
    device_ids: list[int] = Field(default_factory=list, max_length=50)
    endpoint: str = Field(default='', max_length=500)
    description: str = Field(default='', max_length=2000)
    enabled: bool = True

    @model_validator(mode='after')
    def validate_profile(self):
        self.name = self.name.strip()
        self.endpoint = self.endpoint.strip()
        if not self.name:
            raise ValueError('请输入环境名称')
        if len(set(self.device_ids)) != len(self.device_ids) or any(i <= 0 for i in self.device_ids):
            raise ValueError('设备编号无效或重复')
        if self.endpoint:
            value = urlsplit(self.endpoint)
            if value.scheme not in ('http', 'https') or not value.hostname or value.username or value.password or value.fragment:
                raise ValueError('请提供不含账号密码的 HTTP(S) 地址')
            if value.port is not None and not 1 <= value.port <= 65535:
                raise ValueError('端口无效')
        if self.kind == 'device' and not self.device_ids:
            raise ValueError('设备环境至少关联一台设备')
        if self.kind in ('service', 'dedicated') and not self.endpoint:
            raise ValueError('服务环境需配置检测地址')
        return self


class ImportPayload(BaseModel):
    profiles: list[EnvironmentPayload] = Field(min_length=1, max_length=100)


class BatchPayload(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=100)
    enabled: bool


def path_for(project_id):
    if project_id <= 0:
        raise HTTPException(400, '项目编号无效')
    ensure_project_access(project_id)
    return database.UPLOADS_DIR / 'environment-profiles' / f'{project_id}.json'


def read_profiles(project_id):
    path = path_for(project_id)
    if not path.exists():
        return []
    try:
        records = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(records, list):
            raise ValueError('invalid registry')
        return records
    except (ValueError, OSError) as error:
        raise HTTPException(503, '环境配置文件无法读取，请恢复备份后重试') from error


def write_profiles(project_id, records):
    path = path_for(project_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    pending = path.with_suffix(f'.{uuid.uuid4().hex}.tmp')
    pending.write_text(json.dumps(records, ensure_ascii=False), encoding='utf-8')
    pending.replace(path)


def validate_devices(payload):
    if not payload.device_ids:
        return
    with database.connection() as conn:
        for device_id in payload.device_ids:
            row = database.fetch_one(conn, 'SELECT * FROM devices WHERE id=?', (device_id,))
            if not row:
                raise HTTPException(400, f'设备 #{device_id} 不存在')
            specs = database.json_loads(row.get('device_specs'), {})
            actual = str(specs.get('platform') or 'android').lower()
            if payload.kind == 'device' and payload.platform != 'none' and payload.platform != actual:
                raise HTTPException(400, f'设备 #{device_id} 与所选平台不一致')


def new_record(payload):
    return {**payload.model_dump(), 'id': uuid.uuid4().hex, 'health': 'unchecked', 'health_message': '尚未检测', 'checked_at': None, 'updated_at': database.utc_now(), 'revision': 1}


@router.get('/capabilities/')
def capabilities():
    return {'status': 'success', 'data': {'profiles': True, 'tcp_probe': True, 'device_probe': 'android-adb', 'execution_binding': False}}


@router.get('/')
def list_profiles(project_id: int = Query(gt=0)):
    with _lock:
        return {'status': 'success', 'data': read_profiles(project_id)}


@router.post('/')
def create_profile(payload: EnvironmentPayload, project_id: int = Query(gt=0)):
    with _lock:
        records = read_profiles(project_id)
        validate_devices(payload)
        if len(records) >= 500:
            raise HTTPException(400, '每个项目最多 500 个环境')
        record = new_record(payload)
        records.append(record)
        write_profiles(project_id, records)
        return {'status': 'success', 'data': record}


@router.post('/import/')
def import_profiles(payload: ImportPayload, project_id: int = Query(gt=0)):
    with _lock:
        records = read_profiles(project_id)
        if len(records) + len(payload.profiles) > 500:
            raise HTTPException(400, '导入后环境数量超过上限')
        for profile in payload.profiles:
            validate_devices(profile)
        created = [new_record(profile) for profile in payload.profiles]
        write_profiles(project_id, records + created)
        return {'status': 'success', 'data': created}


@router.post('/batch/')
def batch_profiles(payload: BatchPayload, project_id: int = Query(gt=0)):
    with _lock:
        records = read_profiles(project_id)
        if set(payload.ids) - {r['id'] for r in records}:
            raise HTTPException(404, '部分环境不存在，请刷新')
        for record in records:
            if record['id'] in payload.ids:
                record.update(enabled=payload.enabled, health='unchecked', health_message='配置状态已变更，请重新检测', checked_at=None, updated_at=database.utc_now(), revision=record.get('revision', 1)+1)
        write_profiles(project_id, records)
        return {'status': 'success', 'data': records}


@router.put('/{environment_id}/')
def update_profile(environment_id: str, payload: EnvironmentPayload, project_id: int = Query(gt=0)):
    with _lock:
        records = read_profiles(project_id)
        record = next((r for r in records if r['id'] == environment_id), None)
        if not record:
            raise HTTPException(404, '环境不存在')
        validate_devices(payload)
        record.update(**payload.model_dump(), health='unchecked', health_message='配置已更新，请重新检测', checked_at=None, updated_at=database.utc_now(), revision=record.get('revision', 1)+1)
        write_profiles(project_id, records)
        return {'status': 'success', 'data': record}


@router.delete('/{environment_id}/')
def delete_profile(environment_id: str, project_id: int = Query(gt=0)):
    with _lock:
        records = read_profiles(project_id)
        if not any(r['id'] == environment_id for r in records):
            raise HTTPException(404, '环境不存在')
        write_profiles(project_id, [r for r in records if r['id'] != environment_id])
        return {'status': 'success', 'data': None}


def probe(record):
    if not record['enabled']:
        return 'unchecked', '维护中的配置不进行检测'
    if record['kind'] == 'cloud' or record['platform'] == 'ios':
        return 'unchecked', '当前执行器尚未接入该平台的连通检测'
    if record['kind'] == 'device':
        from .adb import inspect_adb_environment
        with database.connection() as conn:
            settings = database.fetch_one(conn, 'SELECT * FROM settings WHERE id=1')
            devices = [database.fetch_one(conn, 'SELECT * FROM devices WHERE id=?', (i,)) for i in record['device_ids']]
        result = inspect_adb_environment(settings['adb_path'])
        if not result.get('executable_found') or result.get('error'):
            return 'error', result.get('error') or 'ADB 不可用'
        online = {d['device_id'] for d in result.get('devices', []) if d.get('status') in ('available', 'online', 'device')}
        if all(d and d['device_id'] in online for d in devices):
            return 'available', '所关联 Android 设备均可通过 ADB 访问'
        return 'error', '部分关联设备未连接、离线或未授权'
    value = urlsplit(record['endpoint'])
    try:
        # Connection only: no HTTP request, credentials, redirects or response body.
        with socket.create_connection((value.hostname, value.port or (443 if value.scheme == 'https' else 80)), timeout=2):
            pass
        return 'available', 'TCP 端口可达；未验证业务接口及鉴权'
    except OSError:
        return 'error', '目标 TCP 端口无法连接，请检查网络与服务端口'


@router.post('/{environment_id}/probe/')
def probe_profile(environment_id: str, project_id: int = Query(gt=0)):
    with _lock:
        records = read_profiles(project_id)
        record = next((r.copy() for r in records if r['id'] == environment_id), None)
        if not record:
            raise HTTPException(404, '环境不存在')
    try:
        health, message = probe(record)
    except Exception:
        health, message = 'error', '检测未完成，请检查执行器与设备连接'
    with _lock:
        records = read_profiles(project_id)
        current = next((r for r in records if r['id'] == environment_id), None)
        if not current or current.get('revision') != record.get('revision'):
            raise HTTPException(409, '检测期间配置发生变化，请重新检测')
        current.update(health=health, health_message=message, checked_at=database.utc_now())
        write_profiles(project_id, records)
        return {'status': 'success', 'data': current}
