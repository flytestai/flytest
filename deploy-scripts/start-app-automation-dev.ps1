$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot
$runtimeLogsDir = Join-Path $rootDir "runtime-logs"
$djangoDir = Join-Path $rootDir "FlyTest_Django"
$fastApiDir = Join-Path $rootDir "FlyTest_FastAPI_AppAutomation"
$actuatorDir = Join-Path $rootDir "FlyTest_Actuator"

$djangoPython = Join-Path $djangoDir ".venv\Scripts\python.exe"
$actuatorPython = Join-Path $actuatorDir ".venv\Scripts\python.exe"
$fastApiVenvPython = Join-Path $fastApiDir ".venv\Scripts\python.exe"

function Require-Path {
    param(
        [string]$Path,
        [string]$Label
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "[FlyTest] Missing ${Label}: ${Path}"
    }
}

function Resolve-FastApiPython {
    if (Test-Path -LiteralPath $fastApiVenvPython) {
        return $fastApiVenvPython
    }

    $pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($pythonCommand) {
        return $pythonCommand.Source
    }

    $pyCommand = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($pyCommand) {
        return $pyCommand.Source
    }

    throw "[FlyTest] Missing FastAPI python. Create FlyTest_FastAPI_AppAutomation\\.venv or install python.exe/py.exe."
}

function Stop-MatchingProcess {
    param(
        [string]$Label,
        [string[]]$Patterns
    )

    $processes = Get-CimInstance Win32_Process | Where-Object {
        $commandLine = $_.CommandLine
        $executablePath = $_.ExecutablePath
        $name = $_.Name

        foreach ($pattern in $Patterns) {
            if (
                (($commandLine -and $commandLine -like "*$pattern*")) -or
                (($executablePath -and $executablePath -like "*$pattern*")) -or
                (($name -and $name -like "*$pattern*"))
            ) {
                return $true
            }
        }

        return $false
    }

    foreach ($process in $processes) {
        try {
            Stop-Process -Id $process.ProcessId -Force -ErrorAction Stop
            Write-Host "[FlyTest] Stopped old $Label process PID=$($process.ProcessId)" -ForegroundColor Yellow
        } catch {
            Write-Warning "[FlyTest] Failed to stop $Label process PID=$($process.ProcessId): $($_.Exception.Message)"
        }
    }
}

function Start-LoggedProcess {
    param(
        [string]$Label,
        [string]$FilePath,
        [string[]]$Arguments,
        [string]$WorkingDirectory,
        [string]$StdOutLog,
        [string]$StdErrLog
    )

    $process = Start-Process `
        -FilePath $FilePath `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkingDirectory `
        -RedirectStandardOutput $StdOutLog `
        -RedirectStandardError $StdErrLog `
        -PassThru

    Write-Host "[FlyTest] Started $Label PID=$($process.Id)" -ForegroundColor Green
    return $process
}

function Wait-TcpPort {
    param(
        [string]$HostName,
        [int]$Port,
        [int]$TimeoutSeconds = 20
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $async = $client.BeginConnect($HostName, $Port, $null, $null)
            if ($async.AsyncWaitHandle.WaitOne(1000) -and $client.Connected) {
                $client.EndConnect($async)
                $client.Close()
                return $true
            }
        } catch {
            # Ignore and retry until timeout.
        } finally {
            $client.Close()
        }
        Start-Sleep -Milliseconds 500
    }

    return $false
}

Require-Path -Path $djangoPython -Label "Django venv python"
Require-Path -Path $actuatorPython -Label "Actuator venv python"
$fastApiPython = Resolve-FastApiPython

New-Item -ItemType Directory -Force -Path $runtimeLogsDir | Out-Null

$env:DJANGO_SECRET_KEY = "local-dev-secret-key-local-dev-secret-key-123456"
$env:DJANGO_SETTINGS_MODULE = "flytest_django.settings"
$env:UI_AUTOMATION_AI_USE_CELERY = "true"
$env:NO_PROXY = "127.0.0.1,localhost,::1"
$env:no_proxy = $env:NO_PROXY
if (-not $env:UI_AUTOMATION_CELERY_QUEUE) {
    $env:UI_AUTOMATION_CELERY_QUEUE = "ui_automation"
}

Stop-MatchingProcess -Label "Django 8000" -Patterns @(
    "daphne.exe",
    "manage.py runserver 0.0.0.0:8000",
    "manage.py runserver 127.0.0.1:8000",
    "flytest_django.asgi:application"
)
Stop-MatchingProcess -Label "FastAPI 8010" -Patterns @(
    "uvicorn app.main:app",
    "--port 8010"
)
Stop-MatchingProcess -Label "Actuator local-actuator" -Patterns @(
    "main.py --server ws://127.0.0.1:8000/ws/ui/actuator/",
    "--id local-actuator"
)

Start-Sleep -Milliseconds 500

$djangoOut = Join-Path $runtimeLogsDir "django-8000.out.log"
$djangoErr = Join-Path $runtimeLogsDir "django-8000.err.log"
$fastApiOut = Join-Path $runtimeLogsDir "fastapi-8010.out.log"
$fastApiErr = Join-Path $runtimeLogsDir "fastapi-8010.err.log"
$actuatorOut = Join-Path $runtimeLogsDir "actuator.out.log"
$actuatorErr = Join-Path $runtimeLogsDir "actuator.err.log"

foreach ($logPath in @($djangoOut, $djangoErr, $fastApiOut, $fastApiErr, $actuatorOut, $actuatorErr)) {
    Set-Content -Path $logPath -Value $null -NoNewline
}

$null = Start-LoggedProcess `
    -Label "Django 8000" `
    -FilePath $djangoPython `
    -Arguments @("manage.py", "runserver", "0.0.0.0:8000", "--noreload") `
    -WorkingDirectory $djangoDir `
    -StdOutLog $djangoOut `
    -StdErrLog $djangoErr

$fastApiArguments = if ([System.IO.Path]::GetFileName($fastApiPython).ToLowerInvariant() -eq "py.exe") {
    @("-3", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010")
} else {
    @("-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8010")
}

$null = Start-LoggedProcess `
    -Label "FastAPI 8010" `
    -FilePath $fastApiPython `
    -Arguments $fastApiArguments `
    -WorkingDirectory $fastApiDir `
    -StdOutLog $fastApiOut `
    -StdErrLog $fastApiErr

if (-not (Wait-TcpPort -HostName "127.0.0.1" -Port 8000 -TimeoutSeconds 20)) {
    throw "[FlyTest] Django 8000 did not become ready within 20 seconds."
}

$null = Start-LoggedProcess `
    -Label "Actuator local-actuator" `
    -FilePath $actuatorPython `
    -Arguments @(
        "main.py",
        "--server", "ws://127.0.0.1:8000/ws/ui/actuator/",
        "--api", "http://127.0.0.1:8000",
        "--id", "local-actuator",
        "--no-gui"
    ) `
    -WorkingDirectory $actuatorDir `
    -StdOutLog $actuatorOut `
    -StdErrLog $actuatorErr

Write-Host "[FlyTest] App automation dev services started." -ForegroundColor Cyan
Write-Host "[FlyTest] Django log: $djangoErr"
Write-Host "[FlyTest] FastAPI log: $fastApiErr"
Write-Host "[FlyTest] Actuator log: $actuatorErr"
