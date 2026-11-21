@echo off
rem Double-click to update the kiosk Pi (connect to SLSU-Kiosk-Map first).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-kiosk.ps1" %*
echo.
pause
