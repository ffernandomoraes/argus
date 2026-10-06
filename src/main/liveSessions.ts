import { readdir, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { LiveStatus } from '../shared/history'

// Cada Claude Code aberto (VS Code, terminal, este app) mantém ~/.claude/sessions/<pid>.json
// com a sessão e o status: "busy" rodando, "waiting" pedindo permissão ou resposta, "idle" parado.
// Formato interno do Claude Code, não documentado: pode mudar entre versões.
const DIR = join(homedir(), '.claude', 'sessions')

const STATUS: Record<string, LiveStatus> = { busy: 'running', waiting: 'needs-you', idle: 'idle' }

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    // EPERM: existe, mas é de outro usuário.
    return (e as NodeJS.ErrnoException).code === 'EPERM'
  }
}

// sessionId → status, só de processos que ainda estão rodando.
export async function liveSessions(): Promise<Map<string, LiveStatus>> {
  const out = new Map<string, LiveStatus>()
  let names: string[]
  try {
    names = (await readdir(DIR)).filter((n) => /^\d+\.json$/.test(n))
  } catch {
    return out
  }
  await Promise.all(
    names.map(async (name) => {
      try {
        const info = JSON.parse(await readFile(join(DIR, name), 'utf8'))
        if (typeof info.sessionId !== 'string' || !alive(Number(info.pid))) return
        const status = STATUS[info.status] ?? 'idle'
        // A mesma sessão aberta em dois lugares: vale o status mais urgente.
        const prev = out.get(info.sessionId)
        if (!prev || prev === 'idle' || status === 'needs-you') out.set(info.sessionId, status)
      } catch {
        // arquivo sendo regravado
      }
    })
  )
  return out
}
