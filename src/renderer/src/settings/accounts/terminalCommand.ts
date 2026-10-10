import { displayPath } from '../../canvas/factory'
import { IS_WIN } from '../../platform'

// Comando para usar a conta num terminal qualquer, fora do app. No Mac, para o zsh/bash. No
// Windows, para o PowerShell (lá a variável vale até fechar o terminal), com o caminho entre aspas
// simples: dentro de aspas duplas o PowerShell interpreta `$` e a crase. A aspa simples do próprio
// caminho vai dobrada, que é como o PowerShell a escreve dentro delas.
export function terminalCommand(dir: string): string {
  return IS_WIN ? `$env:CLAUDE_CONFIG_DIR='${dir.replace(/'/g, "''")}'; claude` : `CLAUDE_CONFIG_DIR=${displayPath(dir)} claude`
}
