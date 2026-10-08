@echo off
title Distinto SCZ - Enlace publico
cd /d "%~dp0"
rem Enciende la pagina y crea un enlace publico temporal (Cloudflare, gratis y sin cuenta)
rem para abrirla desde cualquier celular, con Wi-Fi o con datos moviles.

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Falta instalar Node.js. Descargalo desde https://nodejs.org ^(boton LTS^)
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

if not exist "tools\cloudflared.exe" (
  echo.
  echo  Descargando el programa de Cloudflare ^(solo la primera vez, unos 60 MB^)...
  if not exist tools mkdir tools
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'tools\cloudflared.exe'"
  if errorlevel 1 (
    del /q "tools\cloudflared.exe" >nul 2>nul
    echo.
    echo  No se pudo descargar. Revisa tu conexion a internet e intentalo de nuevo.
    echo.
    pause
    exit /b 1
  )
)

set SHARE=1
set OPEN_BROWSER=1
node --disable-warning=ExperimentalWarning server.js

echo.
echo  La pagina se apago. Puedes cerrar esta ventana.
pause
