# Marcas OSC 133 com o nonce deste terminal (ver src/main/terminals/shellMarks.ts): A antes de cada
# prompt, C quando um comando começa e D quando ele termina, com o código de saída. O nonce vem de um
# arquivo que só este shell lê, e que ele apaga em seguida.

# O ZDOTDIR e as variáveis da integração voltam ao que seriam sem o Argus, para os programas que a
# pessoa rodar (e outro zsh aberto dentro deste) não herdarem a pasta do Argus.
__argus_restore() {
  emulate -L zsh
  if [[ -z $ARGUS_USER_ZDOTDIR || $ARGUS_USER_ZDOTDIR == $HOME ]]; then
    unset ZDOTDIR
  else
    export ZDOTDIR=$ARGUS_USER_ZDOTDIR
  fi
  unset ARGUS_USER_ZDOTDIR __argus_zdotdir
  unfunction __argus_restore
}

__argus_precmd() {
  local code=$?
  emulate -L zsh
  if (( __argus_running )); then
    builtin printf '\e]133;D;%d;nonce=%s\a' $code $__argus_nonce
    __argus_running=0
  fi
  builtin printf '\e]133;A;nonce=%s\a' $__argus_nonce
  return $code
}

__argus_preexec() {
  emulate -L zsh
  __argus_running=1
  builtin printf '\e]133;C;nonce=%s\a' $__argus_nonce
}

() {
  emulate -L zsh
  typeset -g __argus_nonce=
  if [[ -n $ARGUS_SHELL_NONCE_FILE && -r $ARGUS_SHELL_NONCE_FILE ]]; then
    __argus_nonce=$(<$ARGUS_SHELL_NONCE_FILE)
    command rm -f -- $ARGUS_SHELL_NONCE_FILE
  fi
  unset ARGUS_SHELL_NONCE_FILE
  if [[ -z $__argus_nonce ]]; then
    unfunction __argus_precmd __argus_preexec
    return 0
  fi
  typeset -gi __argus_running=0
  # O nosso precmd primeiro, para ler o código de saída antes de qualquer outro.
  precmd_functions=(__argus_precmd ${precmd_functions:#__argus_precmd})
  preexec_functions=(${preexec_functions:#__argus_preexec} __argus_preexec)
}
