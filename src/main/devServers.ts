import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { DevServer } from '../shared/devServers'

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

let ownGroup: Promise<number> | null = null
function ownPgid(): Promise<number> {
  ownGroup ??= output(PS, ['-o', 'pgid=', '-p', String(process.pid)]).then((s) => Number(s.trim()))
  return ownGroup
}

// Grupos com um binário do Claude Code dentro. O Claude põe cada comando num grupo próprio,
// mas os servidores MCP ficam no grupo dele: encerrar um desses derrubaria a sessão.
async function claudeGroups(): Promise<Set<number>> {
  const groups = new Set<number>()
  for (const line of (await output(PS, ['-ax', '-o', 'pgid=,comm='])).split('\n')) {
    const m = line.match(/^\s*(\d+)\s+(.*)$/)
    if (m && /(^|\/)claude$|\/claude\/versions\//.test(m[2].trim())) groups.add(Number(m[1]))
  }
  return groups
}

// Todo comando que o Claude Code roda herda CLAUDECODE=1. Seguir a árvore de processos não
// serve: rodando em segundo plano, o servidor perde o pai e é adotado pelo sistema.
export async function listDevServers(): Promise<DevServer[]> {
  const ports = parseFields(await output(LSOF, ['-nP', '-iTCP', '-sTCP:LISTEN', '-Fpn']), 'n')
  if (ports.size === 0) return []
  const pids = [...ports.keys()].join(',')

  // -E junta o ambiente ao fim do comando; é só para achar a marca e a sessão.
  const withEnv = parsePs(await output(PS, ['-E', '-ww', '-o', 'pid=,pgid=,command=', '-p', pids]))
  const marked = [...withEnv].filter(([, p]) => /(^|\s)CLAUDECODE=1(\s|$)/.test(p.rest)).map(([pid]) => pid)
  if (marked.length === 0) return []

  const list = marked.join(',')
  const [plain, cwds, self, withClaude] = await Promise.all([
    output(PS, ['-ww', '-o', 'pid=,pgid=,command=', '-p', list]).then(parsePs),
    output(LSOF, ['-a', '-d', 'cwd', '-p', list, '-Fpn']).then((s) => parseFields(s, 'n')),
    ownPgid(),
    claudeGroups()
  ])

  const servers: DevServer[] = []
  for (const pid of marked) {
    const info = plain.get(pid)
    if (!info) continue
    const sessionId = withEnv.get(pid)!.rest.match(/(?:^|\s)CLAUDE_CODE_SESSION_ID=([\w-]+)/)?.[1]
    // IPv4 e IPv6 da mesma porta viram uma linha só.
    const unique = new Set(ports.get(pid)!.map((addr) => Number(addr.slice(addr.lastIndexOf(':') + 1))))
    for (const port of unique) {
      if (!port) continue
      servers.push({
        port,
        pid,
        pgid: info.pgid,
        cwd: cwds.get(pid)?.[0] ?? '',
        command: info.rest,
        sessionId,
        locked: info.pgid === self ? 'app' : withClaude.has(info.pgid) ? 'claude' : undefined
      })
    }
  }
  return servers.sort((a, b) => a.port - b.port)
}

function groupAlive(pgid: number): boolean {
  try {
    process.kill(-pgid, 0)
    return true
  } catch {
    return false
  }
}

// Encerra o grupo inteiro do servidor. Confere de novo na hora: só grupos que a lista mostra,
// e nunca um travado. Quem ignorar o SIGTERM leva SIGKILL depois de alguns segundos.
export async function killDevServer(pgid: number): Promise<boolean> {
  const target = (await listDevServers()).find((s) => s.pgid === pgid)
  if (!target || target.locked || pgid <= 1) return false
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
