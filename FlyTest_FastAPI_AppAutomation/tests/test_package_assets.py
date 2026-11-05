import io
import unittest
import zipfile
from unittest.mock import patch

from fastapi import HTTPException
from app import database
from app import package_assets
from tests import test_app_api_smoke as smoke


class PackageAssetTests(unittest.TestCase):
    def setUp(self):
        self.harness = smoke.AppApiSmokeTests()
        self.harness.setUp()
        self.client = self.harness.client

    def tearDown(self):
        self.harness.tearDown()

    def package(self, platform="android"):
        return self.client.post("/packages/", json={"project_id": 1, "name": "测试应用", "package_name": "com.feice.demo", "platform": platform}).json()["data"]["id"]

    def archive(self, name="AndroidManifest.xml"):
        output = io.BytesIO()
        with zipfile.ZipFile(output, "w") as archive:
            archive.writestr(name, b"manifest")
        return output.getvalue()

    def upload(self, package_id, extension="apk", content=None):
        return self.client.post(f"/packages/{package_id}/upload/?version_name=v2.6.0&version_code=268", files={"file": (f"demo.{extension}", content if content is not None else self.archive(), "application/octet-stream")})

    def test_upload_download_and_list_do_not_leak_storage_path(self):
        package_id = self.package()
        content = self.archive()
        response = self.upload(package_id, content=content)
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()["data"]
        self.assertEqual(data["file_size"], len(content))
        self.assertEqual(data["version_name"], "v2.6.0")
        self.assertNotIn("storage_name", data)
        self.assertEqual(self.client.get(f"/packages/{package_id}/download/").content, content)
        row = self.client.get("/packages/?project_id=1").json()["data"][0]
        self.assertTrue(row["has_file"])
        self.assertEqual(row["installations"], [])
        changed_identity = self.client.put(f"/packages/{package_id}/", json={"project_id": 1, "name": "测试应用", "package_name": "com.feice.other", "platform": "android"})
        self.assertEqual(changed_identity.status_code, 409)

    def test_archive_format_size_and_project_access_are_checked(self):
        package_id = self.package()
        self.assertEqual(self.upload(package_id, content=b"not a zip").status_code, 400)
        self.assertEqual(self.upload(package_id, extension="ipa").status_code, 400)
        self.assertEqual(self.upload(package_id, content=self.archive("wrong.txt")).status_code, 400)
        with patch.object(package_assets, "MAX_PACKAGE_BYTES", 10):
            self.assertEqual(self.upload(package_id).status_code, 413)
        with patch.object(package_assets, "ensure_row_project_access", side_effect=HTTPException(403, "denied")):
            self.assertEqual(self.upload(package_id).status_code, 403)
            self.assertEqual(self.client.get(f"/packages/{package_id}/download/").status_code, 403)

    def test_ipa_can_be_archived_but_not_installed_by_adb(self):
        package_id = self.package("ios")
        self.assertEqual(self.upload(package_id, "ipa", self.archive("Payload/Demo.app/Info.plist")).status_code, 200)
        self.assertEqual(self.client.post(f"/packages/{package_id}/install/?device_id=1").status_code, 400)

    def test_aab_archive_and_download_path_validation(self):
        package_id = self.package()
        response = self.upload(package_id, "aab", self.archive("base/manifest/AndroidManifest.xml"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.post(f"/packages/{package_id}/install/?device_id=1").status_code, 400)
        row = package_assets.package_row(package_id)
        metadata = package_assets.read_metadata(row)
        metadata["storage_name"] = "../../outside.apk"
        package_assets.write_metadata(row, metadata)
        self.assertEqual(self.client.get(f"/packages/{package_id}/download/").status_code, 404)

    def test_apk_install_success_and_failure_release_device_lease(self):
        package_id = self.package()
        self.assertEqual(self.upload(package_id).status_code, 200)
        now = database.utc_now()
        with database.connection() as conn:
            cursor = conn.execute("INSERT INTO devices (device_id,name,status,android_version,created_at,updated_at) VALUES (?,?,?,?,?,?)", ("emulator-5554", "测试设备", "available", "14", now, now))
            device_id = cursor.lastrowid
        with patch.object(package_assets, "run_adb_device_command", return_value="Success") as command:
            result = self.client.post(f"/packages/{package_id}/install/?device_id={device_id}")
            self.assertEqual(result.json()["data"]["status"], "installed", result.text)
            self.assertIn("install", command.call_args.args)
        with patch.object(package_assets, "run_adb_device_command", side_effect=RuntimeError("disconnected")):
            result = self.client.post(f"/packages/{package_id}/install/?device_id={device_id}")
            self.assertEqual(result.json()["data"]["status"], "failed")
            self.assertIsNone(result.json()["data"]["progress"])
        with database.connection() as conn:
            device = database.fetch_one(conn, "SELECT status,locked_by FROM devices WHERE id = ?", (device_id,))
        self.assertEqual(device, {"status": "available", "locked_by": ""})


if __name__ == "__main__":
    unittest.main()
