import type { DailyReport, ModelUsage } from '../../shared/telemetry'

// O que um dia junta até ser mandado. Funções puras: o serviço (index.ts) cuida de relógio,
// arquivo e envio.

export type DayStats = Pick<DailyReport, 'time' | 'counts' | 'models' | 'tools' | 'snapshot'> & {
  app: DailyReport['app'] | null
}

export const emptyDay = (): DayStats => ({
  app: null,
  time: { activeMinutes: 0, focusedMinutes: 0, runningMinutes: 0 },
  counts: { appOpens: 0, workspacesCreated: 0, worktreesCreated: 0, chatsCreated: {}, messagesSent: {} },
  models: {},
  tools: {},
  snapshot: null
})

export const emptyUsage = (): ModelUsage => ({ turns: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 })

// Dia local, AAAA-MM-DD: o "dia" de quem usa, não o de Greenwich.
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function bump(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by
}

export function addUsage(day: DayStats, key: string, u: Omit<ModelUsage, 'turns'>, turns = 1): void {
  const cur = (day.models[key] ??= emptyUsage())
  cur.turns += turns
  cur.input += u.input
  cur.output += u.output
  cur.cacheRead += u.cacheRead
  cur.cacheWrite += u.cacheWrite
  cur.costUsd += u.costUsd
}

// Nome da ferramenta como vai no relatório. As de MCP ("mcp__servidor__acao") viram "mcp": o nome do
// servidor pode ser o da empresa ou do projeto da pessoa.
export function toolName(name: string): string {
  if (name.startsWith('mcp__')) return 'mcp'
  return /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(name) ? name : 'other'
}

// Totais acumulados de uma conversa (o Claude Code manda o total da sessão a cada fim de pedido).
export type Totals = Record<string, Omit<ModelUsage, 'turns'>>

// O que entrou desde a última leitura da mesma conversa. Total menor que o anterior (um /clear zera
// a conta) recomeça do zero: tudo que veio é novo.
export function usageDelta(before: Totals | undefined, now: Totals): Totals {
  const out: Totals = {}
  for (const [model, cur] of Object.entries(now)) {
    const prev = before?.[model]
    const reset = !prev || cur.input < prev.input || cur.output < prev.output
    const d = reset
      ? cur
      : {
          input: cur.input - prev.input,
          output: cur.output - prev.output,
          cacheRead: Math.max(0, cur.cacheRead - prev.cacheRead),
          cacheWrite: Math.max(0, cur.cacheWrite - prev.cacheWrite),
          costUsd: Math.max(0, cur.costUsd - prev.costUsd)
        }
    if (d.input || d.output || d.cacheRead || d.cacheWrite) out[model] = d
  }
  return out
}
