import type { PsTree } from './macParse'

// Quem é o Claude Code, pela linha de comando. O cli.js do pacote do npm roda pelo node: o nome
// do processo é só "node" (o Windows já reconhecia assim).
export const CLAUDE_SCRIPT = /claude-code[\\/]cli\.js/i
// Mac: o executável (instalador nativo, Homebrew, extensão do VS Code: ".../claude"), a versão
// guardada (".../claude/versions/x") ou o cli.js do npm. Com maiúscula é o app de desktop.
const CLAUDE_MAC = /(^|\/)claude(\s|$)|\/claude\/versions\//

export const isClaudeCommand = (command: string): boolean => CLAUDE_MAC.test(command) || CLAUDE_SCRIPT.test(command)

// Processos que uma sessão do Claude Code abriu no grupo dela (os servidores MCP): o próprio
// Claude ou um pai dele, no mesmo grupo. Encerrar o grupo derrubaria a sessão. Os comandos da
// ferramenta Bash ficam fora, porque o Claude põe cada um num grupo próprio. Ter um Claude
// *dentro* do grupo não conta: é o caso do Argus, que abre as sessões no grupo dele.
export function claudeOwned(tree: PsTree, pid: number): boolean {
  const pgid = tree.get(pid)?.pgid
  for (let at = tree.get(pid), seen = 0; at && at.pgid === pgid && seen < 64; at = tree.get(at.ppid), seen++) {
    if (isClaudeCommand(at.command)) return true
  }
  return false
}

// Os processos acima deste, do pai ao mais antigo (sem o launchd). No pnpm dev, o servidor que
// abriu o Argus é um deles.
export function ancestorPids(tree: PsTree, pid: number): Set<number> {
  const out = new Set<number>()
  let at = tree.get(pid)
  while (at && at.ppid > 1 && !out.has(at.ppid) && out.size < 64) {
    out.add(at.ppid)
    at = tree.get(at.ppid)
  }
  return out
}
