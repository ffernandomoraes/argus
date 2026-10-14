import type { Usage, UsageWindow } from '../../shared/usage'

// Limites do Codex (app-server, `account/rateLimits/read` e o aviso `account/rateLimits/updated`)
// no formato do app. Lógica pura. Conferido na 0.162.1: cada "balde" (limitId) tem até duas
// janelas, com a duração em minutos e o recomeço em segundos Unix. A duração muda com o plano
// (5 horas e semana nos pagos; 30 dias no free).

type RawWindow = { usedPercent?: number; windowDurationMins?: number | null; resetsAt?: number | null } | null | undefined

export type CodexSnapshot = {
  limitId?: string | null
  limitName?: string | null
  primary?: RawWindow
  secondary?: RawWindow
}

export type CodexBuckets = Record<string, CodexSnapshot>

// O balde de todos os modelos; os outros são limites à parte de um modelo.
const MAIN = 'codex'

const keyOf = (s: CodexSnapshot) => s.limitId || MAIN

// Resposta do `account/rateLimits/read`: a visão por balde, ou a antiga, de um balde só.
export function codexBuckets(res: { rateLimits?: CodexSnapshot | null; rateLimitsByLimitId?: Record<string, CodexSnapshot | undefined> | null }): CodexBuckets {
  const out: CodexBuckets = {}
  for (const [id, s] of Object.entries(res.rateLimitsByLimitId ?? {})) if (s) out[id] = s
  if (!Object.keys(out).length && res.rateLimits) out[keyOf(res.rateLimits)] = res.rateLimits
  return out
}

// O aviso é parcial: campo nulo é "não veio desta vez", não "acabou". Mantém o que a última leitura
// trouxe; a próxima leitura completa corrige o que tiver mudado de verdade.
export function mergeCodexSnapshot(current: CodexBuckets, s: CodexSnapshot): CodexBuckets {
  const key = keyOf(s)
  const prev = current[key] ?? {}
  return {
    ...current,
    [key]: {
      limitId: key,
      limitName: s.limitName ?? prev.limitName,
      primary: s.primary ?? prev.primary,
      secondary: s.secondary ?? prev.secondary
    }
  }
}

function toWindow(raw: RawWindow): UsageWindow | null {
  if (!raw || typeof raw.usedPercent !== 'number') return null
  return {
    percent: raw.usedPercent,
    resetsAt: typeof raw.resetsAt === 'number' ? new Date(raw.resetsAt * 1000).toISOString() : null,
    ...(typeof raw.windowDurationMins === 'number' && { minutes: raw.windowDurationMins })
  }
}

// Janelas do balde, da mais curta para a mais longa (sem duração, por último).
function windowsOf(s: CodexSnapshot | undefined): UsageWindow[] {
  const all = [toWindow(s?.primary), toWindow(s?.secondary)].filter((w): w is UsageWindow => !!w)
  return all.sort((a, b) => (a.minutes ?? Infinity) - (b.minutes ?? Infinity))
}

// Nulo: a conta não tem limite para mostrar (chave de API, ou o servidor não informou).
export function codexUsage(buckets: CodexBuckets, now: number): Usage | null {
  const main = windowsOf(buckets[MAIN])
  if (!main.length) return null
  const models = Object.entries(buckets)
    .filter(([id]) => id !== MAIN)
    .flatMap(([id, s]) => windowsOf(s).map((window) => ({ name: s.limitName || id, window })))
  return { session: main[0], weekly: main[1] ?? null, models, updatedAt: now }
}
