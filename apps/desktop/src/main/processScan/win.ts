import { ancestors, listeningPorts, processTable, type WinProcess } from '../winProcesses'
import { CLAUDE_SCRIPT } from './family'
import type { Listening } from './types'

// Windows: sem o lsof e o ps, as portas vêm do netstat e os processos, do PowerShell. A pasta
// (cwd) de outro processo o Windows não informa: fica vazia, e quem procura o servidor de uma
// pasta olha a linha de comando (ver projectServers/matching.ts). Sem grupo de processo, o "grupo"
// é o próprio processo, encerrado com tudo que ele abriu. O ambiente também não: `env` fica vazio.
const TOOL_SHELL = /^(bash|sh|zsh|powershell|pwsh)\.exe$/i
const isClaude = (p: WinProcess) => /^claude\.exe$/i.test(p.name) || CLAUDE_SCRIPT.test(p.command)

export async function scanWindows(): Promise<Listening[]> {
  const ports = await listeningPorts()
  if (ports.size === 0) return []
  // A tabela de processos é lida de novo só quando aparece processo novo com porta aberta (ou a
  // cada 5 minutos): o PowerShell pesa, e o botão do servidor pergunta a cada 5 segundos.
  const table = await processTable(5 * 60_000, [...ports.keys(), process.pid])
  // No pnpm dev, o servidor deste app é um dos processos acima dele.
  const own = new Set(ancestors(table, process.pid).map((p) => p.pid))
  const found: Listening[] = []
  for (const [pid, list] of ports) {
    const proc = table.get(pid)
    const chain = ancestors(table, pid)
    // Do Claude Code: ele mesmo ou o que ele abriu direto (servidores MCP). O que passou pelo shell
    // de um comando dele (a ferramenta Bash) é servidor de projeto, como no Mac.
    const family = [proc, ...chain].filter((p): p is WinProcess => !!p)
    const at = family.findIndex(isClaude)
    const claude = at >= 0 && !family.slice(0, at).some((p) => TOOL_SHELL.test(p.name))
    found.push({
      pid,
      pgid: pid,
      ports: [...list].sort((a, b) => a - b),
      cwd: '',
      command: proc?.command || proc?.name || '',
      current: own.has(pid) || undefined,
      locked: claude ? 'claude' : undefined,
      claude,
      name: proc?.name,
      chain: chain.map((p) => p.pid),
      env: ''
    })
  }
  return found
}
