@echo off
title Distinto SCZ - Actualizar
rem Este archivo se reemplaza a si mismo al actualizar, por eso primero se copia a TEMP.
if /i not "%~1"=="--desde-temp" (
  copy /y "%~f0" "%TEMP%\distinto-scz-actualizar.bat" >nul
  call "%TEMP%\distinto-scz-actualizar.bat" --desde-temp "%~dp0"
  exit /b
)

set "APP=%~2"
set "ZIP_URL=https://github.com/gerard251100/Gerard/archive/refs/heads/claude/perfumery-vendor-platform-fruygb.zip"

echo.
echo  ============================================================
echo   Actualizando Distinto SCZ
echo.
echo   Antes de seguir, CIERRA la ventana negra de la pagina
echo   si esta abierta. Tus perfumes y pedidos no se tocan.
echo  ============================================================
echo.
pause

echo  Descargando la version nueva...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $app=$env:APP.TrimEnd('\'); $zip=Join-Path $env:TEMP 'distinto-scz.zip'; $tmp=Join-Path $env:TEMP 'distinto-scz-nuevo'; Invoke-WebRequest -UseBasicParsing -Uri $env:ZIP_URL -OutFile $zip; if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }; Expand-Archive -Path $zip -DestinationPath $tmp -Force; $src=(Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName; robocopy $src $app /E /XD data uploads /NFL /NDL /NJH /NJS /NP | Out-Null; if ($LASTEXITCODE -ge 8) { throw 'No se pudieron copiar los archivos' }; Remove-Item $zip -Force; Remove-Item $tmp -Recurse -Force"
if errorlevel 1 (
  echo.
  echo  No se pudo actualizar. Revisa tu conexion a internet e intentalo de nuevo.
  echo  Si sigue fallando, descarga el ZIP a mano desde:
  echo  %ZIP_URL%
  echo.
  pause
  exit /b 1
)

echo.
echo  ============================================================
echo   Listo, ya tienes la ultima version.
echo   Se abrira la pagina automaticamente.
echo  ============================================================
echo.
start "" "%APP%INICIAR.bat"
timeout /t 3 >nul
