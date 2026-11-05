"""Project-scoped mobile artifacts; metadata is stored next to immutable files."""
from __future__ import annotations

import json
import re
import threading
import uuid
import zipfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from . import database
from .access_control import ensure_row_project_access
from .adb import AdbError, run_adb_device_command

router = APIRouter(prefix="/packages")
_store_lock = threading.RLock()
MAX_PACKAGE_BYTES = 500 * 1024 * 1024


def success(data):
    return {"success": True, "status": "success", "code": 200, "data": data}


def package_row(package_id):
    with database.connection() as conn:
        row = database.fetch_one(conn, "SELECT * FROM packages WHERE id = ?", (package_id,))
    if not row:
        raise HTTPException(404, "应用包不存在")
    ensure_row_project_access(row)
    return row


def asset_dir(row):
    return database.UPLOADS_DIR / "packages" / str(int(row["project_id"])) / str(int(row["id"]))


def read_metadata(row):
    path = asset_dir(row) / "metadata.json"
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_metadata(row, data):
    folder = asset_dir(row)
    folder.mkdir(parents=True, exist_ok=True)
    pending = folder / f"{uuid.uuid4().hex}.tmp"
    pending.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    pending.replace(folder / "metadata.json")


def public_metadata(row):
    with _store_lock:
        data = read_metadata(row)
    result = {**{key: value for key, value in data.items() if key != "storage_name"}, "has_file": bool(data.get("storage_name")), "asset_management_available": True}
    if any(item.get("status") == "installing" for item in data.get("installations", [])):
        result.update(can_delete=False, delete_block_reason="设备安装进行中")
    return result


def package_file(row, metadata):
    name = str(metadata.get("storage_name") or "")
    if not name or not re.fullmatch(r"[a-f0-9]{32}\.(apk|aab|ipa)", name):
        raise HTTPException(404, "尚未上传安装包文件")
    target = (asset_dir(row) / name).resolve()
    if not target.is_relative_to(asset_dir(row).resolve()) or not target.is_file():
        raise HTTPException(404, "安装包文件不存在")
    return target


@router.get("/capabilities/")
def package_capabilities():
    return success({"files": True, "formats": ["apk", "aab", "ipa"], "install_formats": ["apk"], "max_bytes": MAX_PACKAGE_BYTES})


@router.post("/{package_id}/upload/")
def upload_package(package_id: int, file: UploadFile, version_name: str = Query(default="", max_length=100), version_code: str = Query(default="", max_length=64)):
    row = package_row(package_id)
    filename = str(file.filename or "").replace("\\", "/").split("/")[-1]
    extension = Path(filename).suffix.lower().lstrip(".")
    if extension not in {"apk", "aab", "ipa"}:
        raise HTTPException(400, "仅支持 APK、AAB 和 IPA 文件")
    expected = "ios" if extension == "ipa" else "android"
    if str(row["platform"]).lower() != expected:
        raise HTTPException(400, "文件格式与应用平台不一致")
    folder = asset_dir(row)
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / f"{uuid.uuid4().hex}.{extension}"
    size = 0
    try:
        with target.open("xb") as stream:
            while chunk := file.file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_PACKAGE_BYTES:
                    raise HTTPException(413, "安装包不能超过 500 MB")
                stream.write(chunk)
        try:
            with zipfile.ZipFile(target) as archive:
                names = set(archive.namelist())
            valid = (extension == "apk" and "AndroidManifest.xml" in names) or (extension == "aab" and "base/manifest/AndroidManifest.xml" in names) or (extension == "ipa" and any(name.startswith("Payload/") and name.endswith(".app/Info.plist") for name in names))
            if not valid:
                raise HTTPException(400, "文件内容与安装包格式不符")
        except zipfile.BadZipFile as exc:
            raise HTTPException(400, "不是有效的应用包归档文件") from exc
        with _store_lock:
            previous = read_metadata(row)
            if any(item.get("status") == "installing" for item in previous.get("installations", [])):
                raise HTTPException(409, "设备安装进行中，请完成后再更新文件")
            write_metadata(row, {"storage_name": target.name, "file_name": filename, "file_size": size, "file_type": extension, "version_name": version_name.strip(), "version_code": version_code.strip(), "uploaded_at": database.utc_now(), "installations": []})
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return success(public_metadata(row))


@router.get("/{package_id}/download/")
def download_package(package_id: int):
    row = package_row(package_id)
    with _store_lock:
        data = read_metadata(row)
        target = package_file(row, data)
    return FileResponse(target, media_type="application/octet-stream", filename=data["file_name"])


@router.get("/{package_id}/installations/")
def package_installations(package_id: int):
    return success(public_metadata(package_row(package_id)))


@router.post("/{package_id}/install/")
def install_package(package_id: int, device_id: int = Query(...)):
    row = package_row(package_id)
    token = f"package-install-{uuid.uuid4().hex}"
    with _store_lock:
        data = read_metadata(row)
        target = package_file(row, data)
        if data.get("file_type") != "apk" or row["platform"] != "android":
            raise HTTPException(400, "当前执行器仅直接安装 APK；AAB 需转换，IPA 需 iOS 驱动")
        with database.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            device = database.fetch_one(conn, "SELECT * FROM devices WHERE id = ?", (device_id,))
            if not device or device["status"] not in {"available", "online"}:
                raise HTTPException(409, "请选择在线且空闲的 Android 设备")
            specs = database.json_loads(device.get("device_specs"), {})
            if str(specs.get("platform", "android")).lower() != "android":
                raise HTTPException(400, "设备平台与 APK 不兼容")
            active = database.fetch_one(conn, "SELECT id FROM executions WHERE device_id = ? AND status IN ('pending', 'running') LIMIT 1", (device_id,))
            if active:
                raise HTTPException(409, "设备已被测试任务占用")
            settings = database.fetch_one(conn, "SELECT adb_path FROM settings WHERE id = 1")
            conn.execute("UPDATE devices SET status = 'locked', locked_by = ?, locked_at = ?, updated_at = ? WHERE id = ?", (token, database.utc_now(), database.utc_now(), device_id))
        item = {"device_id": device_id, "device_name": device["name"] or device["device_id"], "status": "installing", "progress": None, "updated_at": database.utc_now()}
        data["installations"] = [entry for entry in data.get("installations", []) if entry["device_id"] != device_id] + [item]
        try:
            write_metadata(row, data)
        except Exception:
            with database.connection() as conn:
                conn.execute("UPDATE devices SET status = ?, locked_by = '', locked_at = NULL WHERE id = ? AND locked_by = ?", (device["status"], device_id, token))
            raise
    try:
        result = run_adb_device_command(settings["adb_path"] if settings else "adb", device["device_id"], "install", "-r", str(target), timeout=180)
        if "Success" not in result:
            raise AdbError("设备没有返回安装成功结果")
        item.update(status="installed", progress=100, error="")
    except Exception:
        item.update(status="failed", progress=None, error="安装失败，请检查设备连接、签名兼容性与 ADB 配置")
    finally:
        item["updated_at"] = database.utc_now()
        try:
            with _store_lock:
                current = read_metadata(row)
                current["installations"] = [entry for entry in current.get("installations", []) if entry["device_id"] != device_id] + [item]
                write_metadata(row, current)
        finally:
            with database.connection() as conn:
                conn.execute("UPDATE devices SET status = ?, locked_by = '', locked_at = NULL, updated_at = ? WHERE id = ? AND locked_by = ?", (device["status"], database.utc_now(), device_id, token))
    return success(item)
