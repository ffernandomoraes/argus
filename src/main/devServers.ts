import { execFile } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { promisify } from 'node:util'
import type { DevServer } from '../shared/devServers'
import { expandHome } from './paths'
import { IS_WIN } from './platform'
import { ancestors, killTree, listeningPorts, processTable, type WinProcess } from './winProcesses'

const run = promisify(execFile)

// Caminhos absolutos: aberto pelo Dock, o app não herda o PATH do terminal.
const LSOF = '/usr/sbin/lsof'
const PS = '/bin/ps'

// lsof sai com erro quando não acha nada; a saída parcial ainda serve.
async function output(file: string, args: string[]): Promise<string> {
  try {
    return (await run(file, args, { timeout: 5000, maxBuffer: 4 * 1024 * 1024 })).stdout
  } catch (err) {
    return (err as { stdout?: string }).stdout ?? ''
  }
}

// Saída `-F` do lsof: uma linha `p<pid>` abre cada processo, seguida das linhas de campo.
function parseFields(text: string, field: string): Map<number, string[]> {
  const out = new Map<number, string[]>()
  let pid = 0
  for (const line of text.split('\n')) {
    if (line[0] === 'p') {
      pid = Number(line.slice(1))
      if (!out.has(pid)) out.set(pid, [])
    } else if (line[0] === field && pid) out.get(pid)!.push(line.slice(1))
  }
  return out
}

// `ps -o pid=,pgid=,command=`: os dois números e o resto da linha.
function parsePs(text: string): Map<number, { pgid: number; rest: string }> {
  const out = new Map<number, { pgid: number; rest: string }>()
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s(.*)$/)
    if (m) out.set(Number(m[1]), { pgid: Number(m[2]), rest: m[3].trim() })
  }
  return out
}

const MARK = /(^|\s)CLAUDECODE=1(\s|$)/
const CLAUDE_BIN = /(^|\/)claude$|\/claude\/versions\//
// Marca do que o play em cima da pasta iniciou (ver startProjectServer).
export const APP_MARK = 'ARGUS_SERVER'
const APP = new RegExp(`(^|\\s)${APP_MARK}=1(\\s|$)`)

// O lsof devolve a pasta real (sem atalhos); a do projeto precisa estar igual para comparar.
export function realRoot(path: string): string {
  const full = resolve(expandHome(path))
  try {
    return realpathSync.native(full)
  } catch {
    return full
  }
}

export const inside = (root: string, cwd: string) => cwd === root || cwd.startsWith(root + sep)

let ownGroup: Promise<number> | null = null
function ownPgid(): Promise<number> {
  ownGroup ??= output(PS, ['-o', 'pgid=', '-p', String(process.pid)]).then((s) => Number(s.trim()))
  return ownGroup
}

// Processos que uma sessão do Claude Code abriu no grupo dela (os servidores MCP): o próprio
// Claude ou um pai dele, no mesmo grupo. Encerrar o grupo derrubaria a sessão. Os comandos da
// ferramenta Bash ficam fora, porque o Claude põe cada um num grupo próprio. Ter um Claude
// *dentro* do grupo não conta: é o caso do Argus, que abre as sessões no grupo dele.
async function claudeOwned(): Promise<(pid: number) => boolean> {
  const table = new Map<number, { ppid: number; pgid: number; comm: string }>()
  for (const line of (await output(PS, ['-ax', '-o', 'pid=,ppid=,pgid=,comm='])).split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/)
    if (m) table.set(Number(m[1]), { ppid: Number(m[2]), pgid: Number(m[3]), comm: m[4].trim() })
  }
  return (pid) => {
    const pgid = table.get(pid)?.pgid
    for (let at = table.get(pid), seen = 0; at && at.pgid === pgid && seen < 64; at = table.get(at.ppid), seen++) {
      if (CLAUDE_BIN.test(at.comm)) return true
    }
    return false
  }
}

// Processo com porta aberta, com todas as portas dele. `claude`: o próprio Claude Code ou algo
// no grupo dele (servidor MCP); não é servidor de projeto nenhum. Só no Windows: `name`, o
// executável (node.exe...), e `chain`, os processos acima dele, do pai ao mais antigo.
export type Listening = Omit<DevServer, 'port'> & { ports: number[]; claude: boolean; name?: string; chain?: number[] }

// `only` filtra pelo ambiente antes das consultas mais caras (cwd, comando sem ambiente).
export async function scanListening(only?: (env: string) => boolean): Promise<(Listening & { env: string })[]> {
  if (IS_WIN) return scanWindows()
  const ports = parseFields(await output(LSOF, ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn']), 'n')
  if (ports.size === 0) return []
  const pids = [...ports.keys()].join(',')

  // -E junta o ambiente ao fim do comando; é só para achar a marca e a sessão.
  const withEnv = parsePs(await output(PS, ['-E', '-ww', '-o', 'pid=,pgid=,command=', '-p', pids]))
  const chosen = [...withEnv].filter(([, p]) => !only || only(p.rest)).map(([pid]) => pid)
  if (chosen.length === 0) return []

  const list = chosen.join(',')
  const [plain, cwds, ofClaude, self] = await Promise.all([
    output(PS, ['-ww', '-o', 'pid=,pgid=,command=', '-p', list]).then(parsePs),
    output(LSOF, ['-a', '-d', 'cwd', '-p', list, '-Fpn']).then((s) => parseFields(s, 'n')),
    claudeOwned(),
    ownPgid()
  ])

  const found: (Listening & { env: string })[] = []
  for (const pid of chosen) {
    const info = plain.get(pid)
    if (!info) continue
    const env = withEnv.get(pid)!.rest
    // IPv4 e IPv6 da mesma porta viram uma linha só.
    const unique = new Set(ports.get(pid)!.map((addr) => Number(addr.slice(addr.lastIndexOf(':') + 1))))
    const claude = ofClaude(pid)
    found.push({
      pid,
      pgid: info.pgid,
      ports: [...unique].filter(Boolean).sort((a, b) => a - b),
      cwd: cwds.get(pid)?.[0] ?? '',
      command: info.rest,
      sessionId: env.match(/(?:^|\s)CLAUDE_CODE_SESSION_ID=([\w-]+)/)?.[1],
      current: info.pgid === self || undefined,
      locked: claude ? 'claude' : undefined,
      claude,
      env
    })
  }
  return found
}

// Windows: sem o lsof e o ps, as portas vêm do netstat e os processos, do PowerShell. A pasta
// (cwd) de outro processo o Windows não informa: fica vazia, e quem procura o servidor de uma
// pasta olha a linha de comando (ver projectServers.ts). Sem grupo de processo, o "grupo" é o
// próprio processo, encerrado com tudo que ele abriu. O ambiente também não: `env` fica vazio.
const TOOL_SHELL = /^(bash|sh|zsh|powershell|pwsh)\.exe$/i
const isClaude = (p: WinProcess) => /^claude\.exe$/i.test(p.name) || /claude-code[\\/]cli\.js/i.test(p.command)

async function scanWindows(): Promise<(Listening & { env: string })[]> {
  const ports = await listeningPorts()
  if (ports.size === 0) return []
  // A tabela de processos é lida de novo só quando aparece processo novo com porta aberta (ou a
  // cada 5 minutos): o PowerShell pesa, e o botão do servidor pergunta a cada 5 segundos.
  const table = await processTable(5 * 60_000, [...ports.keys(), process.pid])
  // No pnpm dev, o servidor deste app é um dos processos acima dele.
  const own = new Set(ancestors(table, process.pid).map((p) => p.pid))
  const found: (Listening & { env: string })[] = []
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

// Nome do app no package.json da pasta (`productName`, o mesmo que aparece na janela), quando a
// pasta tem um nome diferente do app: a do Argus ainda se chama canva-agent-editor.
const names = new Map<string, string | undefined>()
async function productName(cwd: string): Promise<string | undefined> {
  if (!cwd) return undefined
  if (!names.has(cwd)) {
    try {
      const pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'))
      names.set(cwd, typeof pkg.productName === 'string' && pkg.productName.trim() ? pkg.productName.trim() : undefined)
    } catch {
      names.set(cwd, undefined)
    }
  }
  return names.get(cwd)
}

// Nome do pacote da pasta (package.json), para dizer qual app é cada porta num monorepo: o
// productName, senão o name sem o escopo ("@loja/admin" vira "admin").
const packages = new Map<string, string | undefined>()
export async function packageName(cwd: string): Promise<string | undefined> {
  if (!cwd) return undefined
  if (!packages.has(cwd)) {
    try {
      const pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'))
      const name = [pkg.productName, pkg.name].find((n) => typeof n === 'string' && n.trim()) as string | undefined
      packages.set(cwd, name?.trim().replace(/^@[^/]+\//, ''))
    } catch {
      packages.set(cwd, undefined)
    }
  }
  return packages.get(cwd)
}

// Todo comando que o Claude Code roda herda CLAUDECODE=1; o que o play iniciou leva a marca do
// app. Seguir a árvore de processos não serve: rodando em segundo plano, o servidor perde o pai
// e é adotado pelo sistema. Fora isso, qualquer porta aberta dentro de uma pasta do canvas
// (`paths`), venha de onde vier, menos o Claude Code e o grupo dele.
// No Windows não dá para ler o ambiente nem a pasta de outro processo: a lista fica vazia, e a
// interface esconde o painel.
export async function listDevServers(paths: string[] = []): Promise<DevServer[]> {
  if (IS_WIN) return []
  const roots = paths.map(realRoot)
  const marked = (env: string) => MARK.test(env) || APP.test(env)
  // Sem pastas, dá para filtrar pelo ambiente antes das consultas mais caras.
  const listening = await scanListening(roots.length ? undefined : marked)
  const servers: DevServer[] = []
  for (const p of listening) {
    if (!marked(p.env) && (p.claude || !roots.some((root) => inside(root, p.cwd)))) continue
    const appName = await productName(p.cwd)
    for (const port of p.ports) {
      servers.push({ port, pid: p.pid, pgid: p.pgid, cwd: p.cwd, appName, command: p.command, sessionId: p.sessionId, current: p.current, locked: p.locked })
    }
  }
  return servers.sort((a, b) => a.port - b.port)
}

export function groupAlive(pgid: number): boolean {
  try {
    process.kill(-pgid, 0)
    return true
  } catch {
    return false
  }
}

// Encerra o grupo inteiro do servidor. Confere de novo na hora: só grupos que a lista mostra,
// e nunca um travado.
export async function killDevServer(pgid: number, paths: string[] = []): Promise<boolean> {
  if (IS_WIN) return false
  const target = (await listDevServers(paths)).find((s) => s.pgid === pgid)
  if (!target || target.locked) return false
  return terminate(pgid)
}

// Quem ignorar o SIGTERM leva SIGKILL depois de alguns segundos. No Windows, o processo e tudo
// que ele abriu saem de uma vez (taskkill).
export async function terminate(pgid: number): Promise<boolean> {
  if (pgid <= 1) return false
  if (IS_WIN) return killTree(pgid)
  try {
    process.kill(-pgid, 'SIGTERM')
  } catch {
    return false
  }
  for (let i = 0; i < 30 && groupAlive(pgid); i++) await new Promise((r) => setTimeout(r, 100))
  if (groupAlive(pgid)) {
    try {
      process.kill(-pgid, 'SIGKILL')
    } catch {
      // Saiu entre a conferência e o sinal.
    }
  }
  return true
}
