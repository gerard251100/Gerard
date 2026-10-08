#!/bin/bash
# Doble clic para encender la página con un enlace público temporal (Cloudflare, gratis).
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "  Falta instalar Node.js. Descargalo desde nodejs.org"
  open "https://nodejs.org"
  read -p "Presiona Enter para cerrar..."
  exit 1
fi
SHARE=1 OPEN_BROWSER=1 node --disable-warning=ExperimentalWarning server.js
