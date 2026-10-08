@echo off
title Distinto SCZ - Enlace publico
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\sin-pausa.ps1" >nul 2>nul
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

rem Si una descarga anterior quedo a medias, el archivo es muy chico: se borra y se descarga de nuevo.
if exist "tools\cloudflared.exe" for %%F in ("tools\cloudflared.exe") do if %%~zF LSS 10000000 del /q "tools\cloudflared.exe"

if not exist "tools\cloudflared.exe" (
  echo.
  echo  Descargando el programa de Cloudflare ^(solo la primera vez, unos 60 MB^)...
  echo  Puede tardar unos minutos segun tu internet. No cierres esta ventana.
  echo.
  if not exist tools mkdir tools
  del /q "tools\cloudflared.part" >nul 2>nul
  call :descargar
rem Con curl se ve una barra de progreso; si no existe, se usa PowerShell.
set "CF_URL=https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
where curl >nul 2>nul
if errorlevel 1 goto descargar_powershell
curl -L --fail --progress-bar -o "tools\cloudflared.part" "%CF_URL%"
if errorlevel 1 exit /b 1
exit /b 0

:descargar_powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri $env:CF_URL -OutFile 'tools\cloudflared.part'"
if errorlevel 1 exit /b 1
exit /b 0
