Param(
  [string]$ComposeFile = "infra/docker-compose.dev.yml",
  [string]$OverrideFile = "infra/docker-compose.payment.override.yml",
  [switch]$Remove
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$composePath = Join-Path $repoRoot $ComposeFile
$overridePath = Join-Path $repoRoot $OverrideFile

if (-not (Test-Path $composePath)) {
  throw "Compose file not found: $composePath"
}

$services = @("payment-service", "kafka", "zookeeper", "redis", "postgres")
$args = @("-f", $composePath)
if (Test-Path $overridePath) {
  $args += @("-f", $overridePath)
}

Write-Host "Stopping payment-service stack..." -ForegroundColor Cyan
& docker compose @args stop @services

if ($Remove) {
  Write-Host "Removing containers for payment-service stack..." -ForegroundColor Yellow
  & docker compose @args rm -f @services
}
