$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$djangoDir = Join-Path $rootDir "FlyTest_Django"
$pythonExe = Join-Path $djangoDir ".venv\\Scripts\\python.exe"

if (-not (Test-Path $pythonExe)) {
    Write-Error "[FlyTest] 未找到 Django 虚拟环境: $pythonExe"
}

Set-Location $djangoDir

if (-not $env:DJANGO_SECRET_KEY) {
    $env:DJANGO_SECRET_KEY = "local-dev-secret-key-local-dev-secret-key-123456"
}

$env:DJANGO_SETTINGS_MODULE = "flytest_django.settings"
$env:UI_AUTOMATION_AI_USE_CELERY = "true"

if (-not $env:UI_AUTOMATION_CELERY_QUEUE) {
    $env:UI_AUTOMATION_CELERY_QUEUE = "ui_automation"
}

Write-Host "[FlyTest] 启动 UI 自动化 Celery Worker..." -ForegroundColor Cyan
Write-Host "[FlyTest] Queue=$($env:UI_AUTOMATION_CELERY_QUEUE)"
Write-Host "[FlyTest] Broker=$($env:CELERY_BROKER_URL)"

& $pythonExe -m celery -A flytest_django worker -l info -Q $env:UI_AUTOMATION_CELERY_QUEUE --pool solo
