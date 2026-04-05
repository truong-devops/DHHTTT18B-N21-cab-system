<#
  Set EXPO_PUBLIC_API_BASE_URL for both Expo apps (customer & driver) based on host IPv4.

  Usage examples:
    # auto-pick first non-loopback IPv4
    .\scripts\set-expo-ip.ps1

    # force a specific IP
    .\scripts\set-expo-ip.ps1 -Ip 192.168.56.1

  Notes:
    - Only edits EXPO_PUBLIC_API_BASE_URL lines in:
        apps/customer-app/.env
        apps/driver-app/.env
    - Leaves other lines unchanged.
#>

[CmdletBinding()]
param(
    [string] $Ip
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

function Pick-IPv4 {
    param([string] $PreferredIp)
    if ($PreferredIp) { return $PreferredIp }

    $all = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object {
            $_.IPAddress -notlike "127.*" -and
            $_.IPAddress -notlike "169.254.*"
        } |
        Sort-Object InterfaceMetric, SkipAsSource

    if (-not $all) {
        throw "Không tìm thấy IPv4 hợp lệ. Hãy truyền tham số -Ip."
    }

    return ($all | Select-Object -First 1 -ExpandProperty IPAddress)
}

function Update-EnvFile {
    param(
        [string] $Path,
        [string] $Ip
    )
    if (-not (Test-Path $Path)) {
        Write-Warning "$Path không tồn tại, bỏ qua."
        return
    }

    $newLine = "EXPO_PUBLIC_API_BASE_URL=http://$Ip:3000"
    $lines = Get-Content $Path
    $found = $false
    $lines = $lines | ForEach-Object {
        if ($_ -match '^EXPO_PUBLIC_API_BASE_URL=') {
            $found = $true
            $newLine
        } else {
            $_
        }
    }
    if (-not $found) { $lines += $newLine }
    Set-Content -Path $Path -Value $lines -Encoding UTF8
    Write-Host "Updated $Path -> $newLine"
}

$chosenIp = Pick-IPv4 -PreferredIp $Ip
Write-Host "Using IPv4: $chosenIp"

Update-EnvFile -Path (Join-Path $repoRoot "apps/customer-app/.env") -Ip $chosenIp
Update-EnvFile -Path (Join-Path $repoRoot "apps/driver-app/.env") -Ip $chosenIp

Write-Host "Done. Khởi động lại Expo để áp dụng."
