@echo off
REM Convenience wrapper to start the full stack on Windows.
REM For options run: powershell -File scripts\start-all.ps1 -?

setlocal
set "REPO=%~dp0"
set "SCRIPT=%REPO%scripts\start-all.ps1"

if not exist "%SCRIPT%" (
  echo start-all.ps1 not found at "%SCRIPT%".
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT%" %*
exit /b %errorlevel%
