#!/bin/bash
# Doble clic para descargar e instalar la última versión de Distinto SCZ.
# Tus perfumes y pedidos no se tocan.
APP="$(cd "$(dirname "$0")" && pwd)"
ZIP_URL="https://github.com/gerard251100/Gerard/archive/refs/heads/claude/perfumery-vendor-platform-fruygb.zip"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo ""
echo "  Actualizando Distinto SCZ."
echo "  Antes de seguir, cierra la ventana de la pagina si esta abierta."
read -p "  Presiona Enter para continuar..."

echo "  Descargando la version nueva..."
if ! curl -fsSL -o "$TMP/nuevo.zip" "$ZIP_URL" || ! unzip -q "$TMP/nuevo.zip" -d "$TMP/nuevo"; then
  echo "  No se pudo descargar. Revisa tu conexion a internet."
  read -p "  Presiona Enter para cerrar..."
  exit 1
fi
SRC="$(find "$TMP/nuevo" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
for ITEM in "$SRC"/* "$SRC"/.[!.]*; do
  [ -e "$ITEM" ] || continue
  case "$(basename "$ITEM")" in data|uploads) continue ;; esac
  cp -R "$ITEM" "$APP/"
done
chmod +x "$APP"/*.command

echo ""
echo "  Listo, ya tienes la ultima version. Abriendo la pagina..."
open "$APP/iniciar.command" 2>/dev/null || "$APP/iniciar.command"
