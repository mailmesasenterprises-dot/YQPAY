@echo off
cd /d "%~dp0"
set GCS_MOCK_MODE=true
node server.js
