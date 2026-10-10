import { readdirSync, readFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LiveStatus } from '../shared/history'
import { statusDirs } from './accounts'

// Cada Claude Code aberto (VS Code, terminal, este app) mantém <pasta da conta>/sessions/<pid>.json
// com a sessão e o status: "busy" rodando, "waiting" pedindo permissão ou resposta, "idle" parado.
// Formato interno do Claude Code, não documentado: pode mudar entre versões.

const STATUS: Record<string, LiveStatus> = { busy: 'running', waiting: 'needs-you', idle: 'idle' }
const STATUS_FILE = /^\d+\.json$/

type StatusFile = { pid: number; sessionId: string | null; status: LiveStatus }

function alive(pid: number): boolean {
  // 0 e negativos são grupos de processos para o kill: nunca um Claude Code.
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    // EPERM: existe, mas é de outro usuário.
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

// Status de um processo que ainda está rodando; nulo se ele já saiu ou se o arquivo está sendo
// regravado (JSON pela metade).
function parseStatus(text: string): StatusFile | null {
  let info: Record<string, unknown> | null
  try {
    info = JSON.parse(text) as Record<string, unknown> | null
  } catch {
    return null
  }
  const pid = Number(info?.pid)
  if (!alive(pid)) return null
  const raw = info?.status
  const status = typeof raw === 'string' && Object.hasOwn(STATUS, raw) ? STATUS[raw] : 'idle'
  return { pid, sessionId: typeof info?.sessionId === 'string' ? info.sessionId : null, status }
}

const readSync = (file: string) => {
  try {
    return readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

const namesSync = (dir: string) => {
  try {
    return readdirSync(dir).filter((n) => STATUS_FILE.test(n))
  } catch {
    return []
  }
}

// sessionId → status, só de processos que ainda estão rodando, de todas as contas.
export async function liveSessions(): Promise<Map<string, LiveStatus>> {
  const out = new Map<string, LiveStatus>()
  await Promise.all(statusDirs().map((dir) => readStatusDir(dir, out)))
  return out
}

async function readStatusDir(dir: string, out: Map<string, LiveStatus>): Promise<void> {
  let names: string[]
  try {
    names = (await readdir(dir)).filter((n) => STATUS_FILE.test(n))
  } catch {
    return
  }
  await Promise.all(
    names.map(async (name) => {
      const info = parseStatus(await readFile(join(dir, name), 'utf8').catch(() => ''))
      if (!info || info.sessionId === null) return
      // A mesma sessão aberta em dois lugares: vale o status mais urgente.
      const prev = out.get(info.sessionId)
      if (!prev || prev === 'idle' || info.status === 'needs-you') out.set(info.sessionId, info.status)
    })
  )
}

// pid → status, lido na hora: o terminal do app roda o `claude` direto e sabe o pid dele. Síncrono
// porque serve à pergunta de fechar o app, que precisa ser decidida no mesmo instante.
export function liveStatusByPid(): Map<number, LiveStatus> {
  const out = new Map<number, LiveStatus>()
  for (const dir of statusDirs()) {
    for (const name of namesSync(dir)) {
      const info = parseStatus(readSync(join(dir, name)))
      if (info) out.set(info.pid, info.status)
    }
  }
  return out
}

// Sessão do `claude` que roda com esse pid (o terminal do app sabe o pid dele); nula se o processo
// saiu ou ainda não gravou o status. Lê um arquivo por conta.
export function sessionIdByPid(pid: number): string | null {
  if (!Number.isInteger(pid) || pid <= 0) return null
  for (const dir of statusDirs()) {
    const info = parseStatus(readSync(join(dir, `${pid}.json`)))
    if (info?.pid === pid && info.sessionId) return info.sessionId
  }
  return null
}
