@echo off
title Distinto SCZ - Restablecer contrasena
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Falta instalar Node.js. Descargalo desde https://nodejs.org
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

node --disable-warning=ExperimentalWarning reset-admin.js
pause
