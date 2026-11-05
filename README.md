# FeiCe 飞测

面向测试团队的 AI 测试管理与自动化协作平台，连接需求评审、测试设计、用例资产、缺陷跟踪和 API / Web / APP 自动化执行。

[English](./README_EN.md) · [快速开始](#快速开始) · [界面预览](#界面预览) · [开发与验证](#开发与验证) · [项目文档](./docs/index.md)

> 产品品牌统一为 **FeiCe 飞测**。`FlyTest_*` 目录、部分环境变量和服务名保留历史名称，与当前代码兼容。

## 核心能力

| 模块 | 当前能力 |
| --- | --- |
| 质量工作台 | 用例总量、执行通过率、待处理缺陷、执行趋势、待处理事项、缺陷风险、自动化矩阵、审核分布与 Token 使用概况 |
| 需求管理 | 文档上传、拆分、评审、专项分析及报告查看 |
| AI 对话与配置 | LangGraph 对话、LLM 配置、提示词、工具审批、知识库与 Skills 协同 |
| 测试资产 | 用例、模块、套件、BUG、执行历史、报告、用例模板与数据工厂 |
| API 自动化 | 接口目录、请求管理、测试用例、环境配置、执行记录与测试报告 |
| Web / UI 自动化 | 页面、页面步骤、用例、AI 智能模式、执行记录、批量执行、公共数据、环境与执行器 |
| APP 自动化 | 概览、设备、应用包、元素、场景编排、用例、套件、执行记录、定时任务、通知日志、执行报告与环境设置 |
| 知识库管理 | 文件 / 文本 / 网页接入、文档处理、项目级概览、已索引片段与检索主题统计 |
| 数据工厂 | 按场景搜索工具，字符、编码、随机、加解密、测试数据、JSON、Crontab，历史、收藏、标签与 API / UI 引用 |
| 团队与扩展 | 项目、用户、组织、权限、操作日志、站内通知、API Key、远程 MCP 与 Skills 管理 |

AI、向量检索和设备执行能力需要配置相应模型、服务或设备；仅启动前端不会自动获得这些能力。

## 最新改版（2026-11）

本轮按统一参考设计重做业务工作区，采用独立页头、统计卡片、紧凑筛选栏和列表；有目录与详情的模块使用分栏布局，小屏下重排或在表格容器内横向滚动。

| 工作区 | 本轮更新 |
| --- | --- |
| 需求管理与 AI 对话 | 需求文档 / 评审 / 分析入口统一；对话历史、项目上下文、知识库、提示词、工具与输入区重新布局 |
| 测试资产 | 测试用例、测试套件、缺陷管理、用例模板、执行报告；目录、列表、详情和审核操作统一 |
| API 自动化 | 接口目录、测试用例、环境配置、执行记录、测试报告；请求编辑、响应、断言及接口概览联动 |
| Web 自动化 | 页面管理、页面步骤、测试用例、AI 智能模式、执行记录、批量执行、公共数据、环境配置、执行器九个子页 |
| APP 自动化 | 十二个子页独立优化，涵盖设备状态、应用分发、元素资产、流程编排、测试执行、调度、通知与报告分析 |
| 知识库与数据工厂 | 项目级知识统计、接入分布和检索主题；工具搜索、场景筛选、最近使用、收藏、标签与记录引用 |
| 项目与用户管理 | 项目成员、资产与近期更新概览；用户审核导航、组织 / 角色 / 账号筛选、只读详情及独立启停操作 |

### 配套能力与使用边界

- **应用包**：新增 APK / AAB / IPA 归档上传、受权限保护的下载和安装记录。直接安装目前支持在线空闲 Android 设备上的 APK；AAB 需转换，IPA 需 iOS 驱动。安装结果依据实际 ADB 返回，不代表设备全部已安装应用。
- **套件与 AI 草稿**：支持顺序执行及多 Android 设备并行队列；AI 元素识别、套件规划和定时任务规划需要可用模型，建议须经用户采用和保存，生成草稿不会自动执行测试。
- **APP 环境**：新增项目环境配置、克隆、导入导出与连通检测。Android 检测依赖 ADB；服务地址检测为 TCP 连通性。配置启停 / 维护不会启动或停止真实设备，也不会自动替换任务实际执行配置。
- **知识统计**：按当前用户可访问项目汇总，已索引片段依据实际索引记录；目前接入方式为文件、文本与网页链接，尚未实现 Git / SVN 自动同步。
- **用户管理**：审核、账号启停与权限分配独立；手机号列表脱敏。批量导入接口尚未提供，入口展示能力说明；最近登录字段未返回时显示“未提供”。
- **数据口径**：不使用效果图中的固定数量或增长率；各页注明全局、项目、当前页或近期样本范围，缺失指标显示占位 / 不可用。浏览器截图中的夹具数据仅用于验证布局。

更新代码后需重新构建前端并重新加载 Django / APP 服务，旧进程不会自动获得新增接口；前端对未就绪能力显示提示。新增应用包文件与项目元数据位于 APP 服务数据目录，部署时须持久化并备份；详见 [APP 服务说明](./FlyTest_FastAPI_AppAutomation/README.md)及[环境设置实现记录](./docs/plans/2026-11-04-app-settings-reference-layout.md)。

## 界面预览

当前前端采用深蓝导航、浅色工作区、青绿主操作与紫色 AI 标识。登录页使用左右分栏；质量工作台突出风险与待办；测试资产支持目录、列表、详情审核三栏；接口支持同屏编辑、执行和响应检查。全站共用主题、控件和响应式规范，并保留深色主题。

测试资产、接口、Web、APP 在主导航中使用直接入口，子页面在工作区标签中切换。本轮进一步完成需求、对话、测试资产、API / Web / APP 子页面及知识库、数据工厂、项目和用户管理的参考图改版；早期整站记录见[剩余页面优化与验收记录](./docs/plans/2026-11-02-workbench-completion.md)。

以下基础界面截图来自此前深蓝青绿版本；本轮新增预览见下方“最新工作区预览”。全部截图使用隔离演示接口夹具，不代表真实项目数据或所有后端字段均已接入。

| 登录页 | 质量工作台 |
| --- | --- |
| ![FeiCe 登录页](./.github/readme-assets/navy-login.png) | ![FeiCe 质量工作台](./.github/readme-assets/navy-dashboard.png) |

| 测试资产与审核 | API 请求工作区 |
| --- | --- |
| ![FeiCe 测试资产](./.github/readme-assets/navy-testcases.png) | ![FeiCe API 请求工作区](./.github/readme-assets/navy-api-workbench.png) |

| Web / UI 自动化 | APP 自动化设备管理 |
| --- | --- |
| ![FeiCe Web 自动化](./.github/readme-assets/navy-ui-automation.png) | ![FeiCe APP 设备管理](./.github/readme-assets/navy-app-devices.png) |

<details>
<summary>查看手机端布局</summary>

<img src="./.github/readme-assets/navy-mobile.png" width="320" alt="FeiCe 手机端质量工作台" />

</details>

### 最新工作区预览

以下为本轮实现后的浏览器截图，使用隔离演示数据。

| 项目管理 | 用户管理 |
| --- | --- |
| ![项目管理](./.github/readme-assets/reference-projects.png) | ![用户管理](./.github/readme-assets/reference-users.png) |

| 知识库管理 | 数据工厂 |
| --- | --- |
| ![知识库管理](./.github/readme-assets/reference-knowledge.png) | ![数据工厂](./.github/readme-assets/reference-data-factory.png) |

### 质量指标配色

- 导航：深蓝 `#111E30`；工作区：`#F5F7FA`；主操作：青绿 `#008F83`；AI：紫色 `#7C5CE2`。
- 通过：绿色 `#008000`；风险：红色 `#E00000`。操作色与质量状态色分开使用。
- 执行通过率：原始值恰好为 **100%** 时绿色，其余有效通过率均为红色。
- 待处理缺陷：红色；自动化覆盖率：**≥80%** 绿色、低于 80% 红色。
- 执行趋势支持通过率与执行量视角，均仅使用绿色和红色表示通过与失败。
- 无有效数据时显示占位或空状态。当前 Django 项目统计未提供自动化覆盖率字段时，首页显示“暂无覆盖率数据”，不根据不同资产数量推算覆盖率。

## 技术与仓库结构

| 目录 | 职责与技术 |
| --- | --- |
| `FlyTest_Vue/` | Vue 3.5、TypeScript 5.8、Vite 6、Pinia、Arco Design Vue 前端 |
| `FlyTest_Django/` | Django 5.2、DRF、SimpleJWT、Channels / ASGI，承载核心业务 API |
| `FlyTest_FastAPI_AppAutomation/` | 独立 FastAPI APP 自动化服务 |
| `FlyTest_Actuator/` | 通过 WebSocket 接入的 Playwright UI 执行器 |
| `FlyTest_MCP/` | MCP 测试工具服务 |
| `FlyTest_Skills/` | 内置 Skills |
| `docs/` | 功能、部署、开发和验收文档 |
| `deploy/`、`deploy-scripts/` | 部署配置与脚本 |

AI 与知识检索使用 LangChain / LangGraph、Qdrant；异步任务使用 Celery / Redis；主后端支持 PostgreSQL 与 SQLite。

```mermaid
flowchart LR
    FE["Vue 前端"] -->|"/api/、/ws/"| BE["Django / ASGI"]
    FE -->|"/api/app-automation/"| APP["FastAPI APP 自动化"]
    BE --> DB["PostgreSQL / SQLite"]
    BE --> JOB["Celery / Redis"]
    BE --> AI["LangGraph / LLM"]
    BE --> KB["知识库 / Qdrant"]
    BE <--> MCP["MCP / Skills"]
    BE <--> ACT["UI 执行器 / Playwright"]
    APP --> DEV["设备 / 应用包 / 场景执行"]
```

## 快速开始

### 方式一：使用当前源码构建 Docker 服务

准备 Git、Docker 与 Docker Compose。根目录 `.env` 用于 Compose 变量替换，Django 本地开发使用另一份 `FlyTest_Django/.env`。

```bash
git clone https://github.com/flytestai/flytest.git
cd flytest
cp .env.example .env
# 编辑 .env，设置密钥、管理员密码与数据库配置
docker compose -f docker-compose.local.yml up -d --build
```

Windows PowerShell 可用 `Copy-Item ".env.example" ".env"` 替代 `cp`。

`docker-compose.local.yml` 从当前源码构建项目服务。默认 `docker-compose.yml` 混合使用预构建镜像和本地构建，预构建镜像不一定包含 `main` 最新改动；验证当前代码请使用上面的源码构建方式。

| 服务 | 默认本机入口 |
| --- | --- |
| 前端 | http://localhost:8913 |
| Django API | http://localhost:8912/api/ |
| Redis | `localhost:8911` |
| FeiCe MCP | `localhost:8914` |
| MS MCP（按需配置） | `localhost:8915` |
| Playwright MCP | `localhost:8916` |
| Qdrant | `localhost:8918` |
| PostgreSQL | `localhost:8919` |

APP 自动化在容器网络使用 `8010`，通过前端 `/api/app-automation/` 代理访问，默认没有单独暴露宿主机端口。

管理员由容器启动流程按 `DJANGO_ADMIN_USERNAME` / `DJANGO_ADMIN_PASSWORD` 创建。复制示例文件后以 `.env` 中填写的值为准；未设置变量时 Compose 回退为 `admin` / `admin123456`。

### 方式二：本地开发

建议使用 Python 3.11 和 Node.js 20，与仓库 Docker 构建环境保持一致。以下命令以仓库根目录为起点，各服务使用独立终端；Python 服务建议使用独立虚拟环境。

#### 1. Django 主后端

```powershell
cd "FlyTest_Django"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
Copy-Item ".env.example" ".env"
python -m pip install -r requirements.txt
```

Linux / macOS 使用 `source .venv/bin/activate` 激活环境，使用 `cp .env.example .env` 复制配置。

编辑 `FlyTest_Django/.env`：简单本地体验可设置 `DATABASE_TYPE=sqlite`；默认 `postgres` 则需要可用 PostgreSQL，且主机、端口、库名和凭据匹配。随后初始化数据库和管理员：

```bash
python manage.py migrate
python manage.py createsuperuser
python -m uvicorn flytest_django.asgi:application --host 127.0.0.1 --port 8000 --reload
```

使用 ASGI 服务以支持 WebSocket。直接启动本地后端不会执行容器的管理员初始化流程，需要上面的 `createsuperuser`。

#### 2. Vue 前端

```bash
cd FlyTest_Vue
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

打开 http://127.0.0.1:5173/login 。Vite 默认代理 `/api/`、`/media/` 到 Django `8000`，`/ws/` 到其 WebSocket 服务，`/api/app-automation/` 到 FastAPI `8010`。

代理目标可通过进程环境变量 `VITE_PROXY_TARGET`、`VITE_WS_PROXY_TARGET`、`VITE_APP_AUTOMATION_PROXY_TARGET` 覆盖。例如 PowerShell 在启动前设置 `$env:VITE_PROXY_TARGET = "http://127.0.0.1:8000"`。

#### 3. 按功能启动配套服务

- **异步任务与知识库**：需要 Redis、Celery worker，知识库向量检索还需要 Qdrant 及相应模型配置。可在仓库根目录运行 `docker compose -f docker-compose.local.yml up -d redis qdrant`，并将 Django 的 Redis 地址设为 `redis://127.0.0.1:8911/0`、Qdrant 地址设为 `http://127.0.0.1:8918`。
- **WebSocket 多进程通信**：按需设置 `CHANNEL_REDIS_URL=redis://127.0.0.1:8911/1`；单进程本地可不配置。
- **APP 自动化**：独立安装与启动，JWT 密钥必须与 Django 一致。设备连接、驱动与 OCR 等依赖见 [APP 服务说明](./FlyTest_FastAPI_AppAutomation/README.md)。
- **UI 执行器与 MCP**：见 [执行器说明](./FlyTest_Actuator/README.md) 和 [MCP 服务说明](./FlyTest_MCP/README.md)，按实际后端地址与 API Key 配置。

在 Django 虚拟环境中运行 worker；需要定时任务时另开终端启动 beat：

```bash
celery -A flytest_django worker -l info -Q celery,ui_automation
celery -A flytest_django beat -l info
```

Windows 本地调试 worker 可追加 `--pool=solo`。若自定义 `UI_AUTOMATION_CELERY_QUEUE`，worker 的 `-Q` 应包含对应队列。

APP 服务启动示例（先在该目录创建并激活独立虚拟环境；设置 `APP_AUTOMATION_JWT_SECRET` 为 Django 实际使用的 `DJANGO_SECRET_KEY`）：

```bash
cd FlyTest_FastAPI_AppAutomation
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8010 --reload
```

## 开发与验证

在 `FlyTest_Vue/` 中：

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 5176
```

`build` 执行 Vue / TypeScript 类型检查并生成 `dist/`。Vite 预览继承当前配置中的代理，联调时仍需启动相应后端；正式部署使用 Nginx / Docker。

仓库提供布局、交互、登录、首页与质量指标检查脚本。先启动前端，再在 PowerShell 设置统一测试地址（各脚本默认端口不同）：

```powershell
$env:UI_BASE_URL = "http://127.0.0.1:5173"
$env:UI_BROWSER_CHANNEL = "msedge"
npm run test:layout
npm run test:layout:interactions
npm run test:auth
npm run test:dashboard
npm run test:quality
node scripts/verify-a2-details.cjs
```

脚本需要额外可用的 Playwright 包和浏览器；它们不属于生产依赖。可临时运行 `npm install --no-save --package-lock=false playwright`，或通过 `PLAYWRIGHT_MODULE` 指向已有包。使用 Edge 时保留上述浏览器变量；使用 Playwright Chromium 时取消该变量并运行 `npx playwright install chromium`。

这些检查在独立浏览器中拦截接口，不向业务库写入测试数据。截图与报告输出到被 Git 忽略的 `playwright-screenshots/`。布局夹具不能替代真实权限、模型、设备和外部服务的业务验收。

本轮模块验证可在 `FlyTest_Vue/` 中运行（浏览器检查先启动前端，并设置 `UI_BASE_URL`；目前部分模块脚本直接使用已安装的 Edge）：

```bash
npm run test:assets:reference
npm run test:api:reference
npm run test:web:reference
npm run test:app:overview
npm run test:app:settings
npm run test:knowledge:reference
npm run test:data-factory:panel
npm run test:projects:reference
npm run verify:user-reference
```

更多 APP 子页、需求和对话检查入口见 [`package.json`](./FlyTest_Vue/package.json)。不依赖浏览器的数据检查包括 `npm run test:projects:data` 和 `npm run verify:user-data`。

后端可在各自虚拟环境中运行相关回归：

```bash
# FlyTest_Django/
python manage.py test knowledge.test_workspace accounts.tests.UserRegistrationApprovalTests --noinput
# FlyTest_FastAPI_AppAutomation/
python -m unittest discover -s tests -p "test_*workspace.py"
python -m unittest tests.test_package_assets.PackageAssetTests -v
```

Django 使用独立测试数据库；APP 用例使用隔离存储 / 模拟执行器。真实模型、设备安装和外部通知渠道仍须按部署环境联调。

本轮实现与验证详情：[APP 概览](./docs/plans/2026-11-03-app-overview-reference-layout.md) · [知识库](./docs/plans/2026-11-04-knowledge-reference-layout.md) · [数据工厂](./docs/plans/2026-11-04-data-factory-panel-reference.md) · [项目管理](./docs/plans/2026-11-04-project-management-reference.md) · [用户管理](./docs/plans/2026-11-04-user-management-reference.md)。

此前整站精修、响应式布局与检查结果见[精修验收记录](./docs/plans/2026-11-02-refined-workbench.md)。深蓝青绿初版见[验收记录](./docs/plans/2026-11-02-navy-teal-verification.md)，此前 A2 版本见[历史记录](./docs/plans/2026-10-30-feice-a2-verification.md)。

## 文档入口

- [项目文档首页](./docs/index.md) · [快速开始](./docs/QUICK_START.md)
- [前端说明](./FlyTest_Vue/README.md) · [布局与浏览器验证](./FlyTest_Vue/scripts/README-layout.md)
- [Django 后端](./FlyTest_Django/README.md) · [APP 自动化](./FlyTest_FastAPI_AppAutomation/README.md)
- [UI 执行器](./FlyTest_Actuator/README.md) · [MCP 服务](./FlyTest_MCP/README.md)
- [GitHub / Docker 部署](./docs/github-docker-deployment.md) · [UI AI 队列](./docs/UI_AI_QUEUE.md)
- [A2 前端实施记录](./docs/plans/2026-10-30-feice-a2-frontend.md) · [A2 验收记录](./docs/plans/2026-10-30-feice-a2-verification.md)

## 许可证与部署配置

本项目采用 [PolyForm Noncommercial 1.0.0](./LICENSE)，使用与分发范围以许可证原文为准。

对外部署前，请修改示例密钥、管理员密码与 API Key，核对 HTTPS、Cookie、允许的主机和跨域配置。Compose 中存在直接指定的开发配置，不能仅通过修改根 `.env` 假定所有生产配置均已生效；请核对实际 Compose 配置及部署文档。
