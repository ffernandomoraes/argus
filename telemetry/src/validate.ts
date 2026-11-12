// Confere o resumo do dia que o app manda (formato em src/shared/telemetry.ts do app). O endereço
// é público (está dentro do app): tudo que chega é conferido, limitado e reconstruído campo a campo,
// e o que não serve é recusado ou descartado. Nada do que vem é guardado sem passar por aqui.

export type Report = {
  installId: string
  day: string
  app: { version: string; os: string; osVersion: string; arch: string; language: string; wsl: boolean; claudeCode: string | null }
  time: { activeMinutes: number; focusedMinutes: number; runningMinutes: number }
  counts: {
    appOpens: number
    workspacesCreated: number
    worktreesCreated: number
    chatsCreated: Record<string, number>
    messagesSent: Record<string, number>
  }
  models: Record<string, { turns: number; input: number; output: number; cacheRead: number; cacheWrite: number; costUsd: number }>
  tools: Record<string, number>
  snapshot: {
    workspaces: number
    folders: number
    worktrees: number
    groups: number
    chatCards: number
    terminals: number
    notes: number
    claudeAccounts: number
    claudePlans: Record<string, number>
    providers: string[]
    remoteAccess: boolean
  } | null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY = /^\d{4}-\d{2}-\d{2}$/
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,6}([-+][\w.]{1,30})?$/
const AGENTS = ['claude', 'codex', 'gemini', 'cursor']
const SYSTEMS = ['macos', 'windows', 'linux']
// Nomes de modelo e ferramenta: letras, números e pontuação comum de id, sem espaço.
const KEY = /^[\w.:\-/@[\]]{1,80}$/
const MAX_KEYS = 60
// Um dia tem 1.440 minutos.
const MAX_MINUTES = 1440

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

// Número inteiro (ou com casas, quando float) entre 0 e o limite; qualquer outra coisa vira 0.
function num(v: unknown, max: number, float = false): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) return 0
  const n = Math.min(v, max)
  return float ? Math.round(n * 10000) / 10000 : Math.round(n)
}

function str(v: unknown, re: RegExp, fallback: string): string {
  return typeof v === 'string' && re.test(v) ? v : fallback
}

function countMap(v: unknown, allowed: string[] | RegExp, max: number): Record<string, number> {
  const out: Record<string, number> = {}
  if (!isObj(v)) return out
  for (const [k, n] of Object.entries(v).slice(0, MAX_KEYS)) {
    const ok = Array.isArray(allowed) ? allowed.includes(k) : allowed.test(k)
    if (ok) out[k] = num(n, max)
  }
  return out
}

// Dia aceito: até 30 dias atrás e no máximo um à frente (fuso de quem manda).
function dayInRange(day: string, now: number): boolean {
  const t = Date.parse(day + 'T00:00:00Z')
  if (Number.isNaN(t)) return false
  return t >= now - 31 * 86_400_000 && t <= now + 2 * 86_400_000
}

export function validate(body: unknown, now = Date.now()): Report | null {
  if (!isObj(body) || body.v !== 1) return null
  const installId = str(body.installId, UUID, '')
  const day = str(body.day, DAY, '')
  if (!installId || !day || !dayInRange(day, now)) return null
  const a = isObj(body.app) ? body.app : null
  if (!a || !SYSTEMS.includes(a.os as string)) return null
  const t = isObj(body.time) ? body.time : {}
  const c = isObj(body.counts) ? body.counts : {}

  const models: Report['models'] = {}
  if (isObj(body.models)) {
    for (const [k, m] of Object.entries(body.models).slice(0, MAX_KEYS)) {
      const [agent, ...rest] = k.split(':')
      if (!AGENTS.includes(agent) || !rest.length || !KEY.test(k) || !isObj(m)) continue
      models[k] = {
        turns: num(m.turns, 100_000),
        input: num(m.input, 1e11),
        output: num(m.output, 1e11),
        cacheRead: num(m.cacheRead, 1e12),
        cacheWrite: num(m.cacheWrite, 1e11),
        costUsd: num(m.costUsd, 100_000, true)
      }
    }
  }

  let snapshot: Report['snapshot'] = null
  if (isObj(body.snapshot)) {
    const s = body.snapshot
    snapshot = {
      workspaces: num(s.workspaces, 10_000),
      folders: num(s.folders, 100_000),
      worktrees: num(s.worktrees, 100_000),
      groups: num(s.groups, 100_000),
      chatCards: num(s.chatCards, 100_000),
      terminals: num(s.terminals, 100_000),
      notes: num(s.notes, 100_000),
      claudeAccounts: num(s.claudeAccounts, 1000),
      claudePlans: countMap(s.claudePlans, /^[a-z0-9_-]{1,24}$/, 1000),
      providers: Array.isArray(s.providers) ? s.providers.filter((p): p is string => AGENTS.includes(p as string)) : [],
      remoteAccess: s.remoteAccess === true
    }
  }

  return {
    installId,
    day,
    app: {
      version: str(a.version, VERSION, 'unknown'),
      os: a.os as string,
      osVersion: str(a.osVersion, /^[\w.]{1,20}$/, 'unknown'),
      arch: str(a.arch, /^[\w]{1,12}$/, 'unknown'),
      language: str(a.language, /^[a-z]{2}(-[A-Z]{2})?$/, 'unknown'),
      wsl: a.wsl === true,
      claudeCode: typeof a.claudeCode === 'string' && VERSION.test(a.claudeCode) ? a.claudeCode : null
    },
    time: {
      activeMinutes: num(t.activeMinutes, MAX_MINUTES, true),
      focusedMinutes: num(t.focusedMinutes, MAX_MINUTES, true),
      runningMinutes: num(t.runningMinutes, MAX_MINUTES, true)
    },
    counts: {
      appOpens: num(c.appOpens, 10_000),
      workspacesCreated: num(c.workspacesCreated, 10_000),
      worktreesCreated: num(c.worktreesCreated, 10_000),
      chatsCreated: countMap(c.chatsCreated, AGENTS, 100_000),
      messagesSent: countMap(c.messagesSent, AGENTS, 100_000)
    },
    models,
    tools: countMap(body.tools, /^[A-Za-z][A-Za-z0-9_]{0,39}$/, 1_000_000),
    snapshot
  }
}
