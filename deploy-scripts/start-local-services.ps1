param([switch]$SkipFrontend)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$logs = Join-Path $root 'service_logs'
$runtime = Join-Path $logs 'runtime'
$djangoDir = Join-Path $root 'FlyTest_Django'
$appDir = Join-Path $root 'FlyTest_FastAPI_AppAutomation'
$djangoPython = Join-Path $djangoDir '.venv/Scripts/python.exe'
$appPython = Join-Path $logs 'app-venv/Scripts/python.exe'
$mcpPython = Join-Path $logs 'mcp-venv/Scripts/python.exe'
$processFile = Join-Path $logs 'local-service-processes.json'
$managed = @{}
if (Test-Path -LiteralPath $processFile) {
    $saved = Get-Content -LiteralPath $processFile -Raw | ConvertFrom-Json
    foreach ($property in $saved.PSObject.Properties) { $managed[$property.Name] = $property.Value }
}

function Start-ServiceProcess {
    param([string]$Label, [string]$Exe, [string[]]$Arguments, [string]$Directory, [int]$Port = 0)
    if ($managed.ContainsKey($Label)) {
        $running = Get-CimInstance Win32_Process -Filter "ProcessId=$($managed[$Label])" -ErrorAction SilentlyContinue
        if ($running -and $running.ExecutablePath -eq $Exe) { Write-Host "Running: $Label"; return }
    }
    if ($Port -and (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)) {
        throw "Port $Port is occupied. Verify its owner before starting $Label."
    }
    if (-not (Test-Path -LiteralPath $Exe)) { throw "Missing runtime: $Exe" }
    $process = Start-Process -FilePath $Exe -ArgumentList $Arguments -WorkingDirectory $Directory -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $logs "$Label.out.log") -RedirectStandardError (Join-Path $logs "$Label.err.log")
    $managed[$Label] = $process.Id
    $managed | ConvertTo-Json | Set-Content -LiteralPath $processFile -Encoding utf8
    Write-Host "Started: $Label (PID $($process.Id))"
}

function Wait-ServicePort([int]$Port) {
    for ($attempt = 0; $attempt -lt 240; $attempt++) {
        $client = [System.Net.Sockets.TcpClient]::new()
        try { $client.Connect('127.0.0.1', $Port); return } catch { Start-Sleep -Milliseconds 500 } finally { $client.Dispose() }
    }
    throw "Service on port $Port did not start. Check service_logs."
}

New-Item -ItemType Directory -Force -Path $logs | Out-Null
$env:NO_PROXY = '127.0.0.1,localhost,::1'
$env:no_proxy = $env:NO_PROXY
$env:PYTHONUTF8 = '1'
$env:DJANGO_SETTINGS_MODULE = 'flytest_django.settings'
$env:CELERY_BROKER_URL = 'redis://127.0.0.1:6379/0'
$env:CELERY_RESULT_BACKEND = 'redis://127.0.0.1:6379/0'
$env:CHANNEL_REDIS_URL = 'redis://127.0.0.1:6379/1'
$env:UI_AUTOMATION_AI_USE_CELERY = 'true'
$env:UI_AUTOMATION_CELERY_QUEUE = 'ui_automation'
$env:QDRANT_URL = 'http://127.0.0.1:8918'
$env:DJANGO_BASE_URL = 'http://127.0.0.1:8001'
$env:APP_AUTOMATION_DJANGO_BASE_URL = $env:DJANGO_BASE_URL
$env:FLYTEST_BACKEND_URL = $env:DJANGO_BASE_URL
$env:PATH = (Join-Path $runtime 'adb/platform-tools') + ';' + $env:PATH
$privateConfig = Join-Path $logs 'local-service-config.json'
if (Test-Path -LiteralPath $privateConfig) {
    $private = Get-Content -LiteralPath $privateConfig -Raw | ConvertFrom-Json
    $env:DJANGO_SECRET_KEY = $private.django_secret_key
    $env:FLYTEST_API_KEY = $private.mcp_api_key
}
if (-not $env:DJANGO_SECRET_KEY) { throw 'Prepare service_logs/local-service-config.json with the Django signing key first.' }

$redisDir = Join-Path $runtime 'redis/Redis-7.4.3-Windows-x64-msys2'
Start-ServiceProcess 'redis' (Join-Path $redisDir 'redis-server.exe') @('--bind','127.0.0.1','--port','6379','--appendonly','yes') $redisDir 6379
Wait-ServicePort 6379
$env:QDRANT__SERVICE__HOST = '127.0.0.1'
$env:QDRANT__SERVICE__HTTP_PORT = '8918'
$env:QDRANT__SERVICE__GRPC_PORT = '8917'
$env:QDRANT__STORAGE__STORAGE_PATH = Join-Path $runtime 'qdrant/storage'
Start-ServiceProcess 'qdrant' (Join-Path $runtime 'qdrant/qdrant.exe') @('--disable-telemetry') (Join-Path $runtime 'qdrant') 8918
Wait-ServicePort 8918
Start-ServiceProcess 'django' $djangoPython @('-m','daphne','-b','127.0.0.1','-p','8001','flytest_django.asgi:application') $djangoDir 8001
Wait-ServicePort 8001
Start-ServiceProcess 'app-automation' $appPython @('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8010') $appDir 8010
Wait-ServicePort 8010
Start-ServiceProcess 'celery-worker' $djangoPython @('-m','celery','-A','flytest_django','worker','-l','info','-Q','celery,ui_automation','--pool','solo','--hostname','feice-local@%h') $djangoDir
Start-ServiceProcess 'celery-beat' $djangoPython @('-m','celery','-A','flytest_django','beat','-l','info','--schedule',('"' + (Join-Path $logs 'celerybeat-schedule') + '"')) $djangoDir
Start-ServiceProcess 'mcp' $mcpPython @('FlyTest_tools.py') (Join-Path $root 'FlyTest_MCP') 8006
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
$playwrightMcp = Join-Path $logs 'playwright-mcp/node_modules/@playwright/mcp/cli.js'
if (Test-Path -LiteralPath $playwrightMcp) {
    Start-ServiceProcess 'playwright-mcp' $nodeExe @(('"' + $playwrightMcp + '"'),'--host','127.0.0.1','--port','8931','--headless','--browser','msedge','--isolated') $root 8931
}
Start-ServiceProcess 'actuator' $appPython @('main.py','--config',('"' + (Join-Path $logs 'local-actuator.toml') + '"'),'--id','feice-local','--no-gui') (Join-Path $root 'FlyTest_Actuator')

if (-not $SkipFrontend) {
    $frontendDir = Join-Path $root 'FlyTest_Vue'
    $vite = '"' + (Join-Path $frontendDir 'node_modules/vite/bin/vite.js') + '"'
    Start-ServiceProcess 'frontend-dev' $nodeExe @($vite,'--host','127.0.0.1','--port','5175','--strictPort') $frontendDir 5175
    Start-ServiceProcess 'frontend-preview' $nodeExe @($vite,'preview','--host','127.0.0.1','--port','5176','--strictPort') $frontendDir 5176
}
Write-Host 'Local services started. Inspect service_logs/*.err.log and verify authenticated API requests.'
