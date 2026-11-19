@echo off
title AinBondhu
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

if not exist ".env" (
  echo No .env file found. The app will run in demo mode: only the sample cases work.
  echo To turn on live AI, copy .env.example to .env and add your Gemini key.
  echo.
)

echo Starting AinBondhu...
echo The app will open in your browser at http://localhost:3000
echo Keep this window open while you use the app. Close it to stop the app.
echo.

rem Open the browser a few seconds after the server starts
start "" /min cmd /c "timeout /t 3 /nobreak >nul & start "" http://localhost:3000"

node server.js

echo.
echo AinBondhu has stopped. If you see an error above, it may mean the app is
echo already running in another window, or port 3000 is in use.
pause
