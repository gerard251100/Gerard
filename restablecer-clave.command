#!/bin/bash
# Doble clic para restablecer la contraseña del administrador a "admin123".
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Falta instalar Node.js. Descargalo desde nodejs.org"
  open "https://nodejs.org"
  read -p "Presiona Enter para cerrar..."
  exit 1
fi
node --disable-warning=ExperimentalWarning reset-admin.js
read -p "Presiona Enter para cerrar..."
