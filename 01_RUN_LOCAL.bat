@echo off
cd /d "%~dp0"
title Men's Hair Studio V2 - Local
where node >nul 2>&1
if errorlevel 1 (
 echo Node.js is not installed. Install Node.js LTS first.
 pause
 exit /b 1
)
if not exist .env (
 echo.
 echo ERROR: .env file is missing.
 echo Copy .env.example to .env and fill in Supabase + Google Maps keys first.
 echo.
 pause
 exit /b 1
)
if not exist node_modules (
 echo Installing packages for first run...
 call npm.cmd install
 if errorlevel 1 (
   echo npm install failed. Send the full error to ChatGPT.
   pause
   exit /b 1
 )
)
echo Starting local app...
call npm.cmd run dev
pause
