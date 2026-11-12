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
  // A conta não tem a sessão de 5 horas, só o semanal (Claude Ultra verificado, desde 2026-10-30):
  // o servidor manda a lista de limites sem a linha da sessão. `session` fica nulo.
  noSession?: boolean
  updatedAt: number
  // Lido numa abertura anterior do app e guardado (ver usageMonitor/saved.ts): nesta abertura ainda
  // não veio leitura nova da conta.
  saved?: boolean
  // A leitura mais recente não deu certo: os números são os da última que deu (updatedAt).
  // retryAt: o servidor pediu para esperar até essa hora.
  failure?: { reason: UsageFailure; retryAt?: number }
  // Só no que vai para a tela (ver usableUsage): a janela já recomeçou e o número dela saiu; o novo
  // vem na próxima leitura.
  restarted?: { session?: true; weekly?: true }
}

// rate_limited: o servidor recusou por excesso (429), a cota é a mesma de todo `claude` com o mesmo
// login. timeout: sem resposta no prazo (no Windows, o WSL travado). login: vencido ou recusado,
// renovando. failed: o resto (rede, resposta estranha, o `claude` que não abriu). forbidden: o
// endereço de uso recusou a conta (403), nova tentativa em retryAt. unavailable: o `claude` respondeu,
// mas sem os limites (sem login, chave de API). signed_out: o Claude Code apagou o login da conta
// depois de a renovação ser recusada; só volta entrando de novo. wsl_stopped: o uso é o do login de
// uma distro do WSL, e ela está desligada (o app não liga a distro só para ler o uso).
export type UsageFailure = 'rate_limited' | 'timeout' | 'login' | 'failed' | 'forbidden' | 'unavailable' | 'signed_out' | 'wsl_stopped'

// Guardado há mais tempo que isso não aparece mais.
export const SAVED_MAX_MS = 12 * 60 * 60_000
// Leitura desta abertura sem conseguir atualizar há mais que isso: os números somem. Um número de uma
// hora atrás numa janela de 5 horas já é outro (mesma regra do NodeTerm).
export const LIVE_MAX_MS = 60 * 60_000

// A janela que a barra de baixo mostra: a sessão de 5 horas, ou o semanal na conta sem sessão.
// Nulo: nada que valha mostrar (janela recomeçada, guardado antigo, leitura parada).
export function barWindow(usage: Usage): UsageWindow | null {
  return usage.session ?? (usage.noSession ? usage.weekly : null)
}

// A leitura desta abertura passou de LIVE_MAX_MS sem atualizar: a conta fica à vista, sem números,
// com o aviso de que não deu para ler.
export function expiredUsage(usage: Usage, now: number): boolean {
  return !usage.saved && now - usage.updatedAt > LIVE_MAX_MS
}

// O que dá para mostrar agora, sem nunca mostrar uma porcentagem que já não vale. Janela que já
// recomeçou (hora de recomeçar no passado) some: o número dela era da janela anterior (fica marcada
// em `restarted`, e a conta segue na barra sem número até a leitura nova; ver showsUsage). Do
// guardado, some também a janela que ainda não tinha começado (pode ter começado depois) e tudo o
// que for antigo demais. Da leitura desta abertura parada há mais de LIVE_MAX_MS, somem todos os
// números (ver expiredUsage).
export function usableUsage(usage: Usage, now: number): Usage | null {
  if (usage.saved && (now - usage.updatedAt > SAVED_MAX_MS || usage.updatedAt > now)) return null
  const expired = expiredUsage(usage, now)
  const passed = (w: UsageWindow | null): boolean => !!w?.resetsAt && !(Date.parse(w.resetsAt) > now)
  const valid = (w: UsageWindow | null): UsageWindow | null => {
    if (!w || expired) return null
    if (!w.resetsAt) return usage.saved ? null : w
    return passed(w) ? null : w
  }
  const restarted = { ...(passed(usage.session) && { session: true as const }), ...(passed(usage.weekly) && { weekly: true as const }) }
  return {
    ...usage,
    ...(!expired && Object.keys(restarted).length > 0 && { restarted }),
    session: valid(usage.session),
    weekly: valid(usage.weekly),
    models: usage.models.flatMap((m) => {
      const window = valid(m.window)
      return window ? [{ ...m, window }] : []
    })
  }
}

// A conta aparece na barra? (Sobre o que usableUsage devolveu.) A leitura desta abertura, sempre: sem
// janela para mostrar (a sessão acabou de recomeçar, a leitura parou), fica sem número até a
// próxima, em vez de sumir e voltar. O guardado da abertura anterior, só com algum número que ainda
// vale; e o do login de uma distro do WSL desligada, também (ninguém está gastando lá: a linha sai
// quando os números vencem e volta com a distro).
export function showsUsage(usage: Usage): boolean {
  const hasNumber = !!(barWindow(usage) || usage.weekly || usage.models.length)
  return hasNumber || (!usage.saved && usage.failure?.reason !== 'wsl_stopped')
}
