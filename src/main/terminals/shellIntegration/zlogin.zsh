# Ver o .zshenv desta pasta. O último arquivo de um shell de login: o ZDOTDIR volta a ser o da pessoa.
ZDOTDIR="${ARGUS_USER_ZDOTDIR:-$HOME}"
[[ -r "$ZDOTDIR/.zlogin" ]] && builtin source "$ZDOTDIR/.zlogin"
ARGUS_USER_ZDOTDIR="$ZDOTDIR"
(( ${+functions[__argus_restore]} )) && __argus_restore
