Param(
  [string]$ComposeFile = "infra/docker-compose.dev.yml",
  [string]$OverrideFile = "infra/docker-compose.payment.override.yml",
  [switch]$Build,
  [switch]$Logs
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$composePath = Join-Path $repoRoot $ComposeFile
$overridePath = Join-Path $repoRoot $OverrideFile

if (-not (Test-Path $composePath)) {
  throw "Compose file not found: $composePath"
}

if (-not (Test-Path $overridePath)) {
  @'
services:
  payment-service:
    ports:
      - "3007:3007"
'@ | Set-Content -NoNewline $overridePath
}

$services = @("postgres", "redis", "zookeeper", "kafka", "payment-service")
$args = @("-f", $composePath, "-f", $overridePath, "up", "-d")
if ($Build) {
  $args += "--build"
}
$args += $services

Write-Host "Starting payment-service stack..." -ForegroundColor Cyan
& docker compose @args

Write-Host "Health check URL: http://localhost:3007/health" -ForegroundColor Green

if ($Logs) {
  Write-Host "Streaming payment-service logs..." -ForegroundColor Yellow
  & docker compose -f $composePath -f $overridePath logs -f payment-service
}
