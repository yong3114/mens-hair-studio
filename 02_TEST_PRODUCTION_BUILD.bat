@echo off
cd /d "%~dp0"
title Men's Hair Studio - Production Build Test

echo =============================================
echo   MEN'S HAIR STUDIO - PRODUCTION BUILD TEST
echo =============================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js is not installed or not in PATH.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing packages first...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Building production version...
call npm run build
if errorlevel 1 (
  echo.
  echo BUILD FAILED. Take a screenshot and send it to ChatGPT.
  pause
  exit /b 1
)

echo.
echo BUILD SUCCESS.
echo Output folder: dist
pause
