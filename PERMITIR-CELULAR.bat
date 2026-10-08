@echo off
title Distinto SCZ - Permitir el celular
rem Abre el puerto 3000 en el Firewall de Windows para ver la pagina desde el celular (misma red Wi-Fi).
rem Necesita permisos de administrador: Windows preguntara si permites los cambios.

net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

netsh advfirewall firewall delete rule name="Distinto SCZ" >nul 2>&1
netsh advfirewall firewall add rule name="Distinto SCZ" dir=in action=allow protocol=TCP localport=3000 profile=any >nul
if errorlevel 1 (
  echo.
  echo  No se pudo cambiar el firewall. Si usas otro antivirus con firewall
  echo  (Avast, Norton, Kaspersky, ESET...), permite ahi el puerto 3000.
  echo.
  pause
  exit /b 1
)

echo.
echo  ============================================================
echo   Listo: el celular ya puede entrar a la pagina.
echo.
echo   1. Enciende la pagina con INICIAR.bat
echo   2. En el celular (mismo Wi-Fi) abre la direccion que aparece
echo      en la ventana negra, por ejemplo http://192.168.1.45:3000
echo  ============================================================
echo.
pause
