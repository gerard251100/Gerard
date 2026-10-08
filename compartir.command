#!/bin/bash
# Doble clic para encender la página con un enlace público temporal (Cloudflare, gratis).
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "  Falta instalar Node.js. Descargalo desde nodejs.org"
  open "https://nodejs.org"
  read -p "Presiona Enter para cerrar..."
  exit 1
fi
if [ ! -x tools/cloudflared ]; then
  echo "  Descargando el programa de Cloudflare (solo la primera vez)..."
  mkdir -p tools
  case "$(uname -s)-$(uname -m)" in
    Darwin-arm64) ASSET=cloudflared-darwin-arm64.tgz ;;
    Darwin-*)     ASSET=cloudflared-darwin-amd64.tgz ;;
    Linux-aarch64|Linux-arm64) ASSET=cloudflared-linux-arm64 ;;
    *)            ASSET=cloudflared-linux-amd64 ;;
  esac
  URL="https://github.com/cloudflare/cloudflared/releases/latest/download/$ASSET"
  if [[ "$ASSET" == *.tgz ]]; then
    curl -fsSL "$URL" | tar -xz -C tools
  else
    curl -fsSL -o tools/cloudflared "$URL"
  fi
  chmod +x tools/cloudflared 2>/dev/null
  if [ ! -x tools/cloudflared ]; then
    echo "  No se pudo descargar. Revisa tu conexion a internet."
    read -p "Presiona Enter para cerrar..."
    exit 1
  fi
fi
SHARE=1 OPEN_BROWSER=1 node --disable-warning=ExperimentalWarning server.js
