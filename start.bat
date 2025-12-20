@echo off
echo ========================================
echo    Starting SynchroEdit
echo ========================================
echo.

echo [1/2] Starting Node.js server...
start "SynchroEdit Server" cmd /k "node server.js"

echo [2/2] Waiting for server to start...
timeout /t 2 /nobreak >nul

echo [3/3] Opening browser...
start http://localhost:3000/login.html

echo.
echo ========================================
echo    SynchroEdit is now running!
echo ========================================
echo.
echo Server: http://localhost:3000
echo.
echo Press any key to stop the server...
pause >nul

echo.
echo Stopping server...
taskkill /FI "WindowTitle eq SynchroEdit Server*" /T /F >nul 2>&1
echo Server stopped.
