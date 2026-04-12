@echo off
setlocal

set ROOT_DIR=%~dp0..
set DJANGO_DIR=%ROOT_DIR%\FlyTest_Django

cd /d "%DJANGO_DIR%"

if not exist ".venv\Scripts\python.exe" (
  echo [FlyTest] 未找到 Django 虚拟环境: %DJANGO_DIR%\.venv\Scripts\python.exe
  exit /b 1
)

if "%DJANGO_SECRET_KEY%"=="" (
  set DJANGO_SECRET_KEY=local-dev-secret-key-local-dev-secret-key-123456
)

set DJANGO_SETTINGS_MODULE=flytest_django.settings
set UI_AUTOMATION_AI_USE_CELERY=true
if "%UI_AUTOMATION_CELERY_QUEUE%"=="" (
  set UI_AUTOMATION_CELERY_QUEUE=ui_automation
)

echo [FlyTest] 启动 UI 自动化 Celery Worker...
echo [FlyTest] Queue=%UI_AUTOMATION_CELERY_QUEUE%
echo [FlyTest] Broker=%CELERY_BROKER_URL%

".venv\Scripts\python.exe" -m celery -A flytest_django worker -l info -Q %UI_AUTOMATION_CELERY_QUEUE% --pool solo
