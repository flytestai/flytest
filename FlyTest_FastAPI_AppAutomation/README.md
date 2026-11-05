# FeiCe 飞测 APP 自动化 FastAPI

独立的 APP 自动化后端服务，负责设备、应用包、元素、测试用例、执行记录和环境设置等能力。

## 启动

```bash
cd FlyTest_FastAPI_AppAutomation
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

默认接口前缀由前端代理到 `/api/app-automation/*`。

服务默认会复用 Django 的 JWT 登录态进行鉴权，支持 `Authorization: Bearer ...` 和访问 cookie。
独立启动时请确保当前环境已提供 `DJANGO_SECRET_KEY`，或单独设置 `APP_AUTOMATION_JWT_SECRET`。
如果只是本地离线调试，可临时设置 `APP_AUTOMATION_AUTH_DISABLED=true` 关闭鉴权。

## 可选 OCR 能力

如果需要使用 APP 自动化中的 OCR 断言、`foreach_assert`、全屏模板找图等能力，请额外安装：

```bash
python -m pip install easyocr numpy pillow opencv-python
```

未安装这些依赖时，服务仍可正常启动，但执行 OCR 或高级图片匹配相关动作时会返回明确的错误提示。

## 应用包文件与安装

正常更新并重新加载 APP 服务后，下列接口可用，沿用现有应用包模块鉴权与项目访问范围：

| 接口 | 用途 |
| --- | --- |
| `GET /packages/capabilities/` | 文件格式、大小上限与安装能力 |
| `POST /packages/{id}/upload/` | multipart `file` 上传；查询参数 `version_name`、`version_code` |
| `GET /packages/{id}/download/` | 受项目权限保护的文件下载 |
| `GET /packages/{id}/installations/` | 当前归档文件及设备安装记录 |
| `POST /packages/{id}/install/?device_id=...` | 将当前 APK 安装到在线空闲 Android 设备 |

支持 APK / AAB / IPA，最大 500 MB，校验归档结构与平台。文件和元数据保存在 `data/uploads/packages/<project>/<package>/`，文件使用生成的内部名称；接口不暴露存储路径。备份时同时保留数据库和 uploads 目录。

现有数据库结构无需迁移。版本号由上传者填写，不声称已解析二进制清单。安装中的设备使用独占锁，收到 ADB 成功结果才记录完成；失败释放锁。AAB 需要转换为 APK，IPA 需要接入 iOS 驱动。安装记录不等于设备全量应用盘点，旧进程未加载这些接口时前端会保留应用信息维护并提示文件服务未就绪。

测试：`python -m unittest tests.test_package_assets.PackageAssetTests -v`，使用隔离存储和模拟 ADB，不操作真实设备。
