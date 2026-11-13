# Ver o .zshenv desta pasta. Depois do .zshrc da pessoa, liga as marcas (hooks.zsh).
ZDOTDIR="${ARGUS_USER_ZDOTDIR:-$HOME}"
# O /etc/zshrc do macOS guarda o histórico em $ZDOTDIR, que até aqui era a pasta do Argus.
[[ "${HISTFILE:h}" == "$__argus_zdotdir" ]] && HISTFILE="$ZDOTDIR/.zsh_history"
[[ -r "$ZDOTDIR/.zshrc" ]] && builtin source "$ZDOTDIR/.zshrc"
ARGUS_USER_ZDOTDIR="$ZDOTDIR"
[[ -r "$__argus_zdotdir/hooks.zsh" ]] && builtin source "$__argus_zdotdir/hooks.zsh"
# Shell de login ainda lê o .zlogin: o ZDOTDIR volta para cá até lá.
if [[ -o login ]]; then
  ZDOTDIR="$__argus_zdotdir"
elif (( ${+functions[__argus_restore]} )); then
  __argus_restore
fi
