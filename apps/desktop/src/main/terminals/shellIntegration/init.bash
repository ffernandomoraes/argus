# Integração do Argus com o shell do drawer (src/main/terminals/shellIntegration.ts). O bash abre com
# este arquivo no lugar do ~/.bashrc: ele lê o nonce, carrega os arquivos da pessoa como um shell de
# login (ou o ~/.bashrc) e depois marca prompts e comandos com OSC 133 (ver shellMarks.ts): A antes
# de cada prompt, C quando um comando começa e D quando ele termina, com o código de saída.

__argus_nonce=
if [[ -n ${ARGUS_SHELL_NONCE_FILE:-} && -r $ARGUS_SHELL_NONCE_FILE ]]; then
  __argus_nonce=$(< "$ARGUS_SHELL_NONCE_FILE")
  command rm -f -- "$ARGUS_SHELL_NONCE_FILE"
fi
unset ARGUS_SHELL_NONCE_FILE

if [[ -n ${ARGUS_SHELL_LOGIN:-} ]]; then
  unset ARGUS_SHELL_LOGIN
  [[ -r /etc/profile ]] && . /etc/profile
  if [[ -r ~/.bash_profile ]]; then
    . ~/.bash_profile
  elif [[ -r ~/.bash_login ]]; then
    . ~/.bash_login
  elif [[ -r ~/.profile ]]; then
    . ~/.profile
  fi
elif [[ -r ~/.bashrc ]]; then
  . ~/.bashrc
fi

if [[ -n $__argus_nonce ]]; then
  __argus_running=0
  __argus_ready=0
  # Sem como saber o começo do comando (o DEBUG já é da pessoa), o fim vai em todo prompt.
  __argus_every_prompt=0
  __argus_first=1

  __argus_precmd() {
    local code=$?
    if [[ $__argus_running == 1 || ( $__argus_every_prompt == 1 && $__argus_first == 0 ) ]]; then
      builtin printf '\033]133;D;%s;nonce=%s\007' "$code" "$__argus_nonce"
    fi
    __argus_running=0
    __argus_first=0
    builtin printf '\033]133;A;nonce=%s\007' "$__argus_nonce"
    return $code
  }

  __argus_mark_start() {
    __argus_running=1
    builtin printf '\033]133;C;nonce=%s\007' "$__argus_nonce"
  }

  # O DEBUG roda antes de cada comando simples; só o primeiro depois do prompt é o da pessoa. O do
  # próprio PROMPT_COMMAND (Enter sem comando) não conta. "$1" é o $_ de antes, que volta no fim.
  __argus_preexec() {
    if [[ $__argus_ready == 1 && -z ${COMP_LINE:-} ]]; then
      __argus_ready=0
      [[ $BASH_COMMAND == __argus_precmd* ]] || __argus_mark_start
    fi
    : "$1"
  }

  __argus_prompt_done() {
    __argus_ready=1
  }

  if [[ -n ${bash_preexec_imported:-}${__bp_imported:-} ]]; then
    # bash-preexec (atuin, starship...): entra nas listas dele, que já cuidam do DEBUG.
    precmd_functions=(__argus_precmd "${precmd_functions[@]}")
    preexec_functions+=(__argus_mark_start)
  else
    if [[ -z $(trap -p DEBUG) ]]; then
      trap '__argus_preexec "$_"' DEBUG
    else
      __argus_every_prompt=1
    fi
    if [[ $(declare -p PROMPT_COMMAND 2>/dev/null) == "declare -a"* ]]; then
      PROMPT_COMMAND=(__argus_precmd "${PROMPT_COMMAND[@]}" __argus_prompt_done)
    else
      PROMPT_COMMAND=$'__argus_precmd\n'"${PROMPT_COMMAND:-}"$'\n__argus_prompt_done'
    fi
  fi
fi
