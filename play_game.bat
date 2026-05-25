@echo off
cd /d "%~dp0"
echo ==============================================
echo   LUNAIRE - Dreamland Ruins Dev Server (MAIN)
echo ==============================================
echo.
echo [1] Opening browser to http://localhost:5173/...
start http://localhost:5173/
echo.
echo [2] Starting Vite development server...
npm run dev
pause
