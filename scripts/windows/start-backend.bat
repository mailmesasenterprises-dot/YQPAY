@echo off
echo ========================================
echo Starting YQPayNow Backend Server
echo ========================================
cd /d D:\15\backend
echo Current directory: %CD%
echo Starting backend on port 3001...
node server.js
pause
