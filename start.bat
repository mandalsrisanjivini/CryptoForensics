@echo off
echo ===============================================================
echo            Launching CryptoForensics Application                
echo ===============================================================
echo.
echo Starting Python Backend on http://127.0.0.1:8000 ...
start "CryptoForensics Backend" cmd /c "cd /d %~dp0 && python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting 3D Web Dashboard on http://localhost:5173 ...
start "CryptoForensics Frontend" cmd /c "cd /d %~dp0frontend && npm run dev"

echo.
echo Backend API:  http://127.0.0.1:8000/docs
echo Frontend 3D:  http://localhost:5173
echo.
echo Both services launched in separate background terminal windows.
pause
