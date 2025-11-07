@echo off
echo Starting YQPay Backend and Frontend...

echo.
echo Starting Backend Server...
start /B cmd /c "cd /d D:\15\backend && node server.js"

echo.
echo Waiting 3 seconds for backend to start...
timeout 3 >nul

echo.
echo Starting Frontend Server...
cd /d D:\15\frontend
npm start

pause