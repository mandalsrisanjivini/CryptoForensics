@echo off
echo ===================================================
echo   Starting CryptoForensics FastAPI Backend Server  
echo ===================================================
cd /d "%~dp0"
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
pause
