@echo off
title RipNexus — 1-Click Launch
echo ========================================================
echo        Starting RipNexus Media Downloader...
echo ========================================================

:: Check Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python from https://www.python.org/
    pause
    exit /b
)

:: Auto-install dependencies if needed
echo Checking dependencies...
pip install -r requirements.txt --quiet

echo.
echo ========================================================
echo   RipNexus is LIVE! Opening your browser...
echo   URL: http://localhost:5050
echo ========================================================
start http://localhost:5050
python app.py
pause
