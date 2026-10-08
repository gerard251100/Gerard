#!/bin/bash
# Doble clic para encender Distinto SCZ en Mac.
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  Falta instalar Node.js."
  echo "  Descarga la version LTS desde nodejs.org, instalala"
  echo "  y vuelve a abrir iniciar.command"
  echo ""
  open "https://nodejs.org"
  read -p "Presiona Enter para cerrar..."
  exit 1
fi

if ! node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)"; then
  echo ""
  echo "  Tu version de Node.js es muy antigua."
  echo "  Instala la version LTS desde nodejs.org"
  echo ""
  open "https://nodejs.org"
  read -p "Presiona Enter para cerrar..."
  exit 1
fi

OPEN_BROWSER=1 node --disable-warning=ExperimentalWarning server.js
