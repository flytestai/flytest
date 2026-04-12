# UI 自动化 AI 队列模式

本文说明 FlyTest 中 `UI自动化 -> AI智能模式` 的两种执行模式，以及如何启用 Celery + Redis 队列。

## 当前支持的两种模式

### 1. 本地兜底调度

默认情况下，`UI 自动化 AI 任务` 会使用 Django 进程内的本地调度器：

- AI 任务先入库为 `pending`
- 再由本地后台调度线程认领执行
- 不需要额外安装 Redis 或 Celery Worker

适合：

- 本机开发
- 单机演示
- 没有单独消息队列环境时

### 2. Celery 队列模式

启用后，AI 任务会优先进入 Celery 队列，由 Worker 异步消费执行。

适合：

- 长时间 UI 智能任务
- 多个 Django worker 部署
- 希望任务和 Web 进程解耦

## 启用条件

需要具备：

- Redis
- Celery Worker
- Django 进程开启 `UI_AUTOMATION_AI_USE_CELERY=true`

## 推荐环境变量

在 `FlyTest_Django/.env` 中加入：

```env
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/0
UI_AUTOMATION_AI_USE_CELERY=true
UI_AUTOMATION_CELERY_QUEUE=ui_automation
```

说明：

- `UI_AUTOMATION_AI_USE_CELERY=true`
  表示 UI 自动化 AI 任务优先走 Celery
- 如果不设置或设置为 `false`
  系统会自动回退到本地数据库调度线程

## 本地启动方式

### 1. 启动 Redis

如果本机已安装 Redis，直接启动即可。  
如果没有，也可以临时使用 Docker：

```bash
docker run -d --name flytest-redis -p 6379:6379 redis:7
```

### 2. 启动 Django

```bash
cd FlyTest_Django
.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

### 3. 启动 UI 自动化 Celery Worker

Windows `bat`：

```bat
deploy-scripts\start-ui-ai-celery-worker.bat
```

Windows PowerShell：

```powershell
.\deploy-scripts\start-ui-ai-celery-worker.ps1
```

脚本会自动：

- 进入 `FlyTest_Django`
- 设置 `DJANGO_SETTINGS_MODULE`
- 开启 `UI_AUTOMATION_AI_USE_CELERY=true`
- 使用 `ui_automation` 队列启动 Worker

## 运行行为说明

启用 Celery 队列模式后：

- `UI自动化 -> AI智能模式` 创建任务时，记录会先写入数据库
- 状态初始为 `pending`
- Celery Worker 消费后会认领任务并更新为 `running`
- 执行过程中会持续回写：
  - `heartbeat_at`
  - `worker_token`
  - `planned_tasks`
  - `steps_completed`
  - `logs`

执行器在线状态也会同步到数据库心跳表：

- `UiActuatorSession`

这样即使 Django 进程重启，后台仍然能看到最近在线的执行器信息。

## 没有启动 Worker 会怎样

如果：

- `UI_AUTOMATION_AI_USE_CELERY=true`
- 但 Celery / Redis 不可用

系统会自动回退到本地调度器，不会直接报废。  

但如果：

- Redis 可用
- Worker 没启动

任务会进入队列，等待 Worker 消费。  
所以生产环境建议始终同时启动：

- Django
- Redis
- Celery Worker

## 适合生产的进一步优化

当前已经支持：

- 数据库存储任务状态
- Celery 优先、数据库调度兜底
- 执行器在线心跳

如果后续继续增强，建议再补：

- Celery Beat 周期性清理陈旧任务
- 执行器离线超时自动下线
- 更细的任务分片和重试策略
- 任务队列监控面板
