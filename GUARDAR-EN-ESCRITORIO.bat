@echo off
title Guardar proyectos en el Escritorio
rem Descarga los videos y el proyecto de Remotion y los guarda en Escritorio\proyectos.

set "ZIP_URL=https://github.com/gerard251100/Gerard/archive/refs/heads/claude/trusting-volta-t0qknt.zip"

echo.
echo  ============================================================
echo   Guardando todo en la carpeta "proyectos" del Escritorio...
echo  ============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; $dest=Join-Path ([Environment]::GetFolderPath('Desktop')) 'proyectos'; $zip=Join-Path $env:TEMP 'proyectos.zip'; $tmp=Join-Path $env:TEMP 'proyectos-nuevo'; Invoke-WebRequest -UseBasicParsing -Uri $env:ZIP_URL -OutFile $zip; if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }; Expand-Archive -Path $zip -DestinationPath $tmp -Force; $src=(Get-ChildItem $tmp -Directory | Select-Object -First 1).FullName; New-Item -ItemType Directory -Force -Path $dest | Out-Null; robocopy $src $dest /E /NFL /NDL /NJH /NJS /NP | Out-Null; if ($LASTEXITCODE -ge 8) { throw 'No se pudieron copiar los archivos' }; Remove-Item $zip -Force; Remove-Item $tmp -Recurse -Force; Start-Process explorer.exe $dest"
if errorlevel 1 (
  echo.
  echo  No se pudo descargar. Revisa tu conexion a internet e intentalo de nuevo.
  echo  Tambien puedes bajar el ZIP a mano desde:
  echo  %ZIP_URL%
  echo.
  pause
  exit /b 1
)

echo.
echo  Listo. Tus videos estan en Escritorio\proyectos\videos
echo.
timeout /t 5 >nul
