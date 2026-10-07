import { readdirSync, readFileSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LiveStatus } from '../shared/history'
import { statusDirs } from './accounts'

// Cada Claude Code aberto (VS Code, terminal, este app) mantém <pasta da conta>/sessions/<pid>.json
// com a sessão e o status: "busy" rodando, "waiting" pedindo permissão ou resposta, "idle" parado.
// Formato interno do Claude Code, não documentado: pode mudar entre versões.

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

// sessionId → status, só de processos que ainda estão rodando, de todas as contas.
export async function liveSessions(): Promise<Map<string, LiveStatus>> {
  const out = new Map<string, LiveStatus>()
  await Promise.all(statusDirs().map((dir) => readStatusDir(dir, out)))
  return out
}

async function readStatusDir(dir: string, out: Map<string, LiveStatus>): Promise<void> {
  let names: string[]
  try {
    names = (await readdir(dir)).filter((n) => /^\d+\.json$/.test(n))
  } catch {
    return
  }
  await Promise.all(
    names.map(async (name) => {
      try {
        const info = JSON.parse(await readFile(join(dir, name), 'utf8'))
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
}

// pid → status, lido na hora: o terminal do app roda o `claude` direto e sabe o pid dele. Síncrono
// porque serve à pergunta de fechar o app, que precisa ser decidida no mesmo instante.
export function liveStatusByPid(): Map<number, LiveStatus> {
  const out = new Map<number, LiveStatus>()
  for (const dir of statusDirs()) {
    let names: string[]
    try {
      names = readdirSync(dir).filter((n) => /^\d+\.json$/.test(n))
    } catch {
      continue
    }
    for (const name of names) {
      try {
        const info = JSON.parse(readFileSync(join(dir, name), 'utf8'))
        const pid = Number(info.pid)
        if (alive(pid)) out.set(pid, STATUS[info.status] ?? 'idle')
      } catch {
        // arquivo sendo regravado
      }
    }
  }
  return out
}
