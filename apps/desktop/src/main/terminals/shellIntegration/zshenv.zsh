# Integração do Argus com o shell do drawer (src/main/terminals/shellIntegration.ts). O zsh abre com
# o ZDOTDIR nesta pasta: cada arquivo daqui carrega o da pessoa e devolve o ZDOTDIR para cá, para o
# zsh achar o próximo. No fim (.zshrc ou .zlogin) o ZDOTDIR volta a ser o da pessoa.
typeset -g __argus_zdotdir="$ZDOTDIR"
ZDOTDIR="${ARGUS_USER_ZDOTDIR:-$HOME}"
[[ -r "$ZDOTDIR/.zshenv" ]] && builtin source "$ZDOTDIR/.zshenv"
ARGUS_USER_ZDOTDIR="$ZDOTDIR"
ZDOTDIR="$__argus_zdotdir"
