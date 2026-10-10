#!/bin/sh
# Instala (ou atualiza) o Argus a partir do último release no GitHub.
#   curl -fsSL https://raw.githubusercontent.com/ffernandomoraes/argus/main/install.sh | sh
# Baixado pelo curl, o app não recebe a marca de quarentena do macOS, então abre sem o
# aviso de "desenvolvedor não identificado" (o app não é notarizado pela Apple).
# Tudo roda dentro de main, chamada só na última linha: se o download deste script for cortado
# no meio, o sh não chega a executar metade dele.
set -e

REPO="ffernandomoraes/argus"
APP="/Applications/Argus.app"

fail() {
  echo "$1" >&2
  exit 1
}

# Requisito de assinatura (designated requirement). Com o mesmo certificado, é igual em todas as
# versões; é por ele que o macOS reconhece o app e mantém as permissões.
requirement() {
  codesign -d -r- "$1" 2>&1 | grep 'designated =>' || true
}

# Assinado com certificado (e não ad-hoc, que muda a cada versão)?
with_certificate() {
  case "$1" in
    *"certificate leaf"* | *"certificate root"*) return 0 ;;
    *) return 1 ;;
  esac
}

# Espera até ~30 s enquanto o comando der certo.
wait_while() {
  tries=0
  while "$@"; do
    tries=$((tries + 1))
    [ "$tries" -le 60 ] || return 1
    sleep 0.5
  done
}

# Fecha o Argus aberto e espera ele sair de fato: com algo rodando, ele pergunta antes de fechar.
# Depois, espera a troca que o próprio app faz ao fechar com uma versão nova já baixada (o script
# "argus-update"), para as duas não mexerem no app ao mesmo tempo.
quit_running_app() {
  if pgrep -xq Argus; then
    echo "Fechando o Argus aberto..."
    osascript -e 'quit app "Argus"' >/dev/null 2>&1 || true
    wait_while pgrep -xq Argus || fail "O Argus continua aberto. Feche o app e rode a instalação de novo."
  fi
  wait_while pgrep -qf argus-update || fail "A atualização do próprio Argus ainda está rodando. Tente de novo em instantes."
}

# O app baixado precisa estar íntegro e assinado com o certificado do Argus; atualizando, com o
# mesmo certificado do instalado (uma instalação antiga ad-hoc não tem com o que comparar).
verify_download() {
  new="$1"
  codesign --verify --deep --strict "$new" 2>/dev/null || fail "O app baixado não passou na conferência de assinatura."
  new_req=$(requirement "$new")
  with_certificate "$new_req" || fail "O app baixado não está assinado com o certificado do Argus."
  if [ -d "$APP" ]; then
    old_req=$(requirement "$APP")
    if with_certificate "$old_req" && [ "$old_req" != "$new_req" ]; then
      fail "O app baixado foi assinado por outro certificado; nada foi trocado."
    fi
  fi
}

# Troca guardando o app antigo até o novo estar no lugar; se der errado, ele volta.
swap_app() {
  new="$1"
  rm -rf "$APP.old"
  if [ -e "$APP" ]; then
    mv "$APP" "$APP.old" || fail "Sem permissão para trocar o app em /Applications."
  fi
  if ! mv "$new" "$APP"; then
    if [ -e "$APP.old" ]; then mv "$APP.old" "$APP"; fi
    fail "Não deu para pôr o app novo em /Applications; o anterior continua lá."
  fi
  rm -rf "$APP.old"
  xattr -dr com.apple.quarantine "$APP" 2>/dev/null || true
}

main() {
  if [ "$(uname -s)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
    fail "O Argus por enquanto só roda em Mac com Apple Silicon (M1 ou mais novo)."
  fi

  echo "Procurando a última versão..."
  URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
    | grep -o '"browser_download_url": *"[^"]*-arm64\.zip"' | head -n 1 | cut -d '"' -f 4)
  [ -n "$URL" ] || fail "Não achei o arquivo do app no último release de $REPO."

  TMP=$(mktemp -d)
  trap 'rm -rf "$TMP"' EXIT

  echo "Baixando $(basename "$URL")..."
  curl -fL --progress-bar "$URL" -o "$TMP/Argus.zip"
  ditto -x -k "$TMP/Argus.zip" "$TMP"
  [ -x "$TMP/Argus.app/Contents/MacOS/Argus" ] || fail "O arquivo baixado não tem o app."
  verify_download "$TMP/Argus.app"

  quit_running_app
  swap_app "$TMP/Argus.app"

  echo "Pronto: Argus instalado em $APP"
  open "$APP"
}

main "$@"
