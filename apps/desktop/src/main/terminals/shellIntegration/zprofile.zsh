# Ver o .zshenv desta pasta.
ZDOTDIR="${ARGUS_USER_ZDOTDIR:-$HOME}"
[[ -r "$ZDOTDIR/.zprofile" ]] && builtin source "$ZDOTDIR/.zprofile"
ARGUS_USER_ZDOTDIR="$ZDOTDIR"
ZDOTDIR="$__argus_zdotdir"
