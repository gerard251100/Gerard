@echo off
title Distinto SCZ - Enlace publico
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\sin-pausa.ps1" >nul 2>nul

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  ============================================================
  echo   Falta instalar Node.js
  echo.
  echo   1. Se abrira la pagina nodejs.org en tu navegador.
  echo   2. Descarga el boton verde "LTS" e instalalo.
  echo   3. Cuando termine, vuelve a dar doble clic en COMPARTIR.bat
  echo  ============================================================
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

echo.
echo  Encendiendo la pagina con enlace publico...
echo.

set SHARE=1
set OPEN_BROWSER=1
node --disable-warning=ExperimentalWarning server.js

echo.
echo  La pagina se apago. Puedes cerrar esta ventana.
pause
