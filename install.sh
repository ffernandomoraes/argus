#!/bin/sh
# Instala (ou atualiza) o Argus a partir do último release no GitHub.
#   curl -fsSL https://raw.githubusercontent.com/ffernandomoraes/argus/main/install.sh | sh
# Baixado pelo curl, o app não recebe a marca de quarentena do macOS, então abre sem o
# aviso de "desenvolvedor não identificado" (o app não é notarizado pela Apple).
set -e

REPO="ffernandomoraes/argus"
APP="/Applications/Argus.app"

if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
  echo "O Argus por enquanto só roda em Mac com Apple Silicon (M1 ou mais novo)." >&2
  exit 1
fi

echo "Procurando a última versão..."
URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep -o '"browser_download_url": *"[^"]*-arm64\.zip"' | head -n 1 | cut -d '"' -f 4)
if [ -z "$URL" ]; then
  echo "Não achei o arquivo do app no último release de $REPO." >&2
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "Baixando $(basename "$URL")..."
curl -fL --progress-bar "$URL" -o "$TMP/Argus.zip"
ditto -x -k "$TMP/Argus.zip" "$TMP"

if pgrep -xq Argus; then
  echo "Fechando o Argus aberto..."
  osascript -e 'quit app "Argus"' >/dev/null 2>&1 || true
  sleep 2
fi

rm -rf "$APP"
mv "$TMP/Argus.app" "$APP"
xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true

echo "Pronto: Argus instalado em $APP"
open "$APP"
