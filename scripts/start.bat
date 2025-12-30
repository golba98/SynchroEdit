 @echo off
cd /d "%~dp0.."
echo ========================================
echo    Starting SynchroEdit
echo ========================================
echo.

echo [1/2] Starting Node.js server...
start "SynchroEdit Server" cmd /k "node src/server.js"

echo [2/2] Waiting for server to start...
