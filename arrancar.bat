@echo off
rem Starts PickleBrain with a double click.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js not found. Install it from https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo   Installing dependencies for the first time...
  call npm.cmd install --no-audit --no-fund
)

if not exist ".env" (
  echo   Creating .env from .env.example...
  copy /y ".env.example" ".env" >nul
)

where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo   Warning: ffmpeg not found, so voice notes cannot be understood.
  echo   Install it with:   winget install Gyan.FFmpeg
  echo.
)

echo.
echo   Starting PickleBrain...
echo.
node src\index.js
echo.
echo   The bot has stopped.
pause
