@echo off
rem Arranca PickleBrain con doble clic.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   No encuentro Node.js. Instalalo desde https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo   Instalando dependencias por primera vez...
  call npm.cmd install --no-audit --no-fund
)

if not exist ".env" (
  echo   Creando .env a partir de .env.example...
  copy /y ".env.example" ".env" >nul
)

where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo   Aviso: no encuentro ffmpeg, asi que no podre entender las notas de voz.
  echo   Instalalo asi:   winget install Gyan.FFmpeg
  echo.
)

echo.
echo   Arrancando PickleBrain...
echo.
node src\index.js
echo.
echo   El bot se ha detenido.
pause
