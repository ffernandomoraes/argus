// Formato compartilhado entre o processo principal e a interface.
export type UsageWindow = {
  percent: number
  // Nulo enquanto a janela não começou: conta sem mensagem nela ainda.
  resetsAt: string | null
  // Duração da janela em minutos, quando o agente informa (Codex: 300 = 5 horas, 10080 = semana,
  // 43200 = 30 dias no plano free). O Claude não manda: as janelas dele têm rótulo fixo.
  minutes?: number
}

// A chave de cada uso é a conta: a do Claude ("main", 8 letras) ou a de outro agente ("codex:main").
// No Codex, `session` é a janela mais curta e `weekly` a mais longa, com a duração em `minutes`.
export type Usage = {
  session: UsageWindow | null
  weekly: UsageWindow | null
  // Semanal de um modelo só (ex.: Fable), além do semanal de todos. No Codex, os limites à parte de
  // um modelo, com a duração de cada janela.
  models: { name: string; window: UsageWindow }[]
  updatedAt: number
  // Lido numa abertura anterior do app e guardado (ver usageMonitor/saved.ts): nesta abertura ainda
  // não veio leitura nova da conta.
  saved?: boolean
  // A leitura mais recente não deu certo: os números são os da última que deu (updatedAt).
  // retryAt: o servidor pediu para esperar até essa hora.
  failure?: { reason: UsageFailure; retryAt?: number }
}

// rate_limited: o servidor recusou por excesso (429), a cota é a mesma de todo `claude` com o mesmo
// login. timeout: sem resposta no prazo (no Windows, o WSL travado). login: vencido ou recusado,
// renovando. failed: o resto (rede, resposta estranha, o `claude` que não abriu).
export type UsageFailure = 'rate_limited' | 'timeout' | 'login' | 'failed'

// Guardado há mais tempo que isso não aparece mais.
export const SAVED_MAX_MS = 12 * 60 * 60_000
// Leitura desta abertura sem conseguir atualizar há mais que isso: os números somem. Um número de uma
// hora atrás numa janela de 5 horas já é outro (mesma regra do NodeTerm).
export const LIVE_MAX_MS = 60 * 60_000

// A leitura desta abertura passou de LIVE_MAX_MS sem atualizar: a conta fica à vista, sem números,
// com o aviso de que não deu para ler.
export function expiredUsage(usage: Usage, now: number): boolean {
  return !usage.saved && now - usage.updatedAt > LIVE_MAX_MS
}

// O que dá para mostrar agora, sem nunca mostrar uma porcentagem que já não vale. Janela que já
// recomeçou (hora de recomeçar no passado) some: o número dela era da janela anterior. Do guardado,
// some também a janela que ainda não tinha começado (pode ter começado depois) e tudo o que for
// antigo demais. A tela some com a janela; a conta sem sessão sai da barra de baixo. Da leitura desta
// abertura parada há mais de LIVE_MAX_MS, somem todos os números (ver expiredUsage).
export function usableUsage(usage: Usage, now: number): Usage | null {
  if (usage.saved && (now - usage.updatedAt > SAVED_MAX_MS || usage.updatedAt > now)) return null
  const expired = expiredUsage(usage, now)
  const valid = (w: UsageWindow | null): UsageWindow | null => {
    if (!w || expired) return null
    if (!w.resetsAt) return usage.saved ? null : w
    const resetsAt = Date.parse(w.resetsAt)
    return Number.isFinite(resetsAt) && resetsAt > now ? w : null
  }
  return {
    ...usage,
    session: valid(usage.session),
    weekly: valid(usage.weekly),
    models: usage.models.flatMap((m) => {
      const window = valid(m.window)
      return window ? [{ ...m, window }] : []
    })
  }
}
