@echo off
title Distinto SCZ
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
  echo   3. Cuando termine, vuelve a dar doble clic en INICIAR.bat
  echo  ============================================================
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"
if errorlevel 1 (
  echo.
  echo  ============================================================
  echo   Tu version de Node.js es muy antigua.
  echo   Descarga e instala la version "LTS" desde nodejs.org
  echo   y luego vuelve a dar doble clic en INICIAR.bat
  echo  ============================================================
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

set OPEN_BROWSER=1
node --disable-warning=ExperimentalWarning server.js

echo.
echo  La pagina se apago. Puedes cerrar esta ventana.
pause
