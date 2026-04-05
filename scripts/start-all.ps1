<#
    Start the full CAB Booking System stack (Docker infra + 3 UIs) with one command.

    Usage examples:
      .\scripts\start-all.ps1                  # Start infra + UIs
      .\scripts\start-all.ps1 -Observability   # Include observability stack
      .\scripts\start-all.ps1 -SkipUi          # Only infra (no UIs)
      .\scripts\start-all.ps1 -Seed            # Seed demo data after infra is up

    Requirements: Docker Desktop running, Docker Compose, Node.js 18+, npm.
#>

[CmdletBinding()]
param(
    [switch] $Observability,
    [switch] $SkipInfra,
    [switch] $SkipUi,
    [switch] $Seed,
    [switch] $NoInstall,
    [switch] $SkipKafkaBootstrap,
    [switch] $KafkaVerbose
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Ensure-Command {
    param([string] $Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required but not found. Install it and retry."
    }
}

function Ensure-DockerRunning {
    try {
        docker info | Out-Null
    } catch {
        throw "Docker Desktop is not running. Please start it and rerun the script."
    }
}

function Run-NpmScript {
    param([string] $ScriptName)
    npm run $ScriptName
    if ($LASTEXITCODE -ne 0) {
        throw "npm run $ScriptName failed. Check the output above."
    }
}

function Maybe-InstallDependencies {
    param([string] $Path)
    if ($NoInstall) { return }
    if (-not (Test-Path (Join-Path $Path "node_modules"))) {
        Write-Host "Installing dependencies in $Path ..."
        Push-Location $Path
        npm install
        Pop-Location
    }
}

function Get-PrimaryIPv4 {
    $ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notlike "127.*" -and
            $_.IPAddress -notlike "169.254.*"
        } |
        Sort-Object InterfaceMetric, SkipAsSource |
        Select-Object -First 1 -ExpandProperty IPAddress
    if (-not $ip) {
        throw "Không tìm thấy IPv4 hợp lệ (không phải loopback/link-local)."
    }
    return $ip
}

function Update-ExpoEnv {
    param(
        [string] $EnvPath,
        [string] $Ip
    )
    if (-not $Ip -or $Ip -notmatch '^\d{1,3}(\.\d{1,3}){3}$') {
        Write-Warning "IP không hợp lệ: '$Ip' -> giữ nguyên $EnvPath"
        return
    }
    if (-not (Test-Path $EnvPath)) {
        Write-Warning "$EnvPath không tồn tại, bỏ qua."
        return
    }
    $newLine = "EXPO_PUBLIC_API_BASE_URL=http://$Ip:3000"
    $lines = Get-Content $EnvPath
    $updated = $false
    $lines = $lines | ForEach-Object {
        if ($_ -match '^EXPO_PUBLIC_API_BASE_URL=') {
            $updated = $true
            $newLine
        } else {
            $_
        }
    }
    if (-not $updated) {
        $lines += $newLine
    }
    Set-Content -Path $EnvPath -Value $lines -Encoding UTF8
    Write-Host "  -> cập nhật $EnvPath với API_BASE_URL=$($newLine.Split('=')[1])"
}

Push-Location $repoRoot
Write-Host "Repo root: $repoRoot"

Ensure-Command "docker"
Ensure-Command "npm"
Ensure-DockerRunning

$composeScript = if ($Observability) { "dev:observability" } else { "dev:infra" }

if (-not $SkipInfra) {
    $running = docker compose --env-file .env -f infra/docker-compose.dev.yml ps -q 2>$null | Select-Object -First 1
    if ($running) {
        Write-Host "Docker stack already running -> skipping 'npm run $composeScript'. Use -SkipInfra:$false to force rerun."
    } else {
        Write-Host "Starting backend stack with 'npm run $composeScript' ..."
        Run-NpmScript $composeScript
    }

    if (-not $SkipKafkaBootstrap) {
        if (-not $env:KAFKA_BOOTSTRAP_WAIT_ATTEMPTS) { $env:KAFKA_BOOTSTRAP_WAIT_ATTEMPTS = 120 }
        if (-not $env:KAFKA_BOOTSTRAP_WAIT_MS) { $env:KAFKA_BOOTSTRAP_WAIT_MS = 2000 }
        if ($KafkaVerbose) { $env:KAFKA_BOOTSTRAP_VERBOSE = "true" }

        Write-Host "Bootstrapping Kafka topics ..."
        try {
            Run-NpmScript "kafka:topics:bootstrap"
        } catch {
            Write-Warning "Kafka topic bootstrap failed: $($_.Exception.Message). Stack is still up; rerun with -SkipInfra:$false after Kafka is healthy."
        }
    } else {
        Write-Host "SkipKafkaBootstrap requested -> skipping Kafka topic bootstrap."
    }

    if ($Seed) {
        Write-Host "Seeding demo data (npm run seed:all) ..."
        Run-NpmScript "seed:all"
    }
} else {
    Write-Host "SkipInfra requested -> not touching Docker stack."
}

Pop-Location

function Start-Ui {
    param(
        [string] $Name,
        [string] $Path,
        [string] $Script
    )

    Write-Host "Launching $Name (npm run $Script) ..."
    Maybe-InstallDependencies -Path $Path

    Start-Process -FilePath "powershell" -WorkingDirectory $Path -ArgumentList "-NoExit", "-Command", "npm run $Script" | Out-Null
    Write-Host "  -> started in its own terminal window."
}

if (-not $SkipUi) {
    $ip = Get-PrimaryIPv4
    Write-Host "Detected host IP: $ip -> cập nhật EXPO_PUBLIC_API_BASE_URL cho 2 app Expo"
    Update-ExpoEnv -EnvPath "$repoRoot\apps\customer-app\.env" -Ip $ip
    Update-ExpoEnv -EnvPath "$repoRoot\apps\driver-app\.env" -Ip $ip

    Start-Ui -Name "Admin Dashboard" -Path "$repoRoot\apps\admin-dashboard" -Script "dev"
    Start-Ui -Name "Driver App (Expo QR)" -Path "$repoRoot\apps\driver-app" -Script "start"
    Start-Ui -Name "Customer App (Expo QR)" -Path "$repoRoot\apps\customer-app" -Script "start"
} else {
    Write-Host "SkipUi requested -> UI apps will not be launched."
}

Write-Host ""
Write-Host "All services launched."
Write-Host "Quick access:"
Write-Host "  API Gateway:   http://localhost:3000"
Write-Host "  Admin UI:      http://localhost:5173  (user: admin@cab.local / password)"
Write-Host "  Customer Expo: scan QR in its terminal; web dev often http://localhost:19006"
Write-Host "  Driver Expo:   scan QR in its terminal; web dev often http://localhost:19007"
Write-Host "  PgAdmin:       http://localhost:5050  (user: admin@example.com / admin123)"
Write-Host ""
Write-Host "Seeded demo accounts (Auth service):"
Write-Host "  Admin:    admin@cab.local / password"
Write-Host "  Customer: customer@cab.local / 123456"
Write-Host "  Driver:   driver@cab.local / password"
