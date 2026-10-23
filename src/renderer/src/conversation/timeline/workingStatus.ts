import type { ChatActivity, ChatRetry } from '../../../../shared/chat'
import { tr } from '../../i18n'
import { activityLabel } from './activityLabel'

// O que a linha "trabalhando" mostra: o rótulo (que entra animado quando muda), um detalhe que muda
// a cada segundo sem animar (a contagem da nova tentativa) e o andamento da compactação (0 a 100).
export type WorkingStatus = { label: string; detail?: string; progress?: number }

export type WorkingInput = {
  activity?: ChatActivity
  // Subagentes em primeiro plano, que o Claude está esperando.
  foreground: number
  retry?: ChatRetry
  compactingSince?: number
  // Começo do pedido: conta a espera antes da primeira resposta.
  turnStartedAt?: number
  now: number
}

// Esperando a API responder: depois de 5 s, uma destas (fixa por pedido); depois, as de mais tempo.
const WAITING = [
  () => tr('Organizando as ideias…', 'Gathering my thoughts…'),
  () => tr('Pensando no assunto…', 'Mulling it over…'),
  () => tr('Ponderando…', 'Pondering…'),
  () => tr('Refletindo…', 'Reflecting…')
]
const FIRST_PHRASE_MS = 5_000
const LONG_MS = 15_000
const LONGEST_MS = 30_000

// A compactação não informa o andamento: a barra anda rápido no começo e desacelera, sem passar de
// 95% (como no Claude Desktop). Em 25 s chega a ~63%.
const COMPACT_TIME_MS = 25_000
const COMPACT_MAX = 95

export function compactProgress(elapsedMs: number): number {
  return Math.round(Math.min(COMPACT_MAX, (1 - Math.exp(-Math.max(0, elapsedMs) / COMPACT_TIME_MS)) * 100))
}

function retryCause(cause: ChatRetry['cause']): string {
  switch (cause) {
    case 'overloaded':
      return tr('API sobrecarregada', 'API overloaded')
    case 'rate_limit':
      return tr('Limite de requisições da API', 'API rate limit')
    case 'server_error':
      return tr('Erro no servidor da API', 'API server error')
    case 'no_response':
      return tr('A API não respondeu', 'No response from the API')
    default:
      return tr('A requisição falhou', 'The request failed')
  }
}

export function workingStatus(o: WorkingInput): WorkingStatus {
  if (o.compactingSince !== undefined) {
    return { label: tr('Compactando a conversa…', 'Compacting the chat…'), progress: compactProgress(o.now - o.compactingSince) }
  }
  if (o.retry) {
    const seconds = Math.ceil((o.retry.at - o.now) / 1000)
    const attempt = tr(`tentativa ${o.retry.attempt} de ${o.retry.maxRetries}`, `attempt ${o.retry.attempt} of ${o.retry.maxRetries}`)
    return {
      label: tr(`${retryCause(o.retry.cause)}. Tentando de novo…`, `${retryCause(o.retry.cause)}. Retrying…`),
      detail: seconds > 0 ? tr(`em ${seconds} s - ${attempt}`, `in ${seconds}s - ${attempt}`) : attempt
    }
  }
  const label = activityLabel(o.activity, o.foreground)
  const kind = o.activity?.kind
  // Pensando de novo depois de uma ação conta da volta; esperando a API, do começo do pedido.
  const since = kind === 'thinking' ? o.activity!.since : kind === undefined ? o.turnStartedAt : undefined
  if (since === undefined) return { label }
  const waited = o.now - since
  if (kind === 'thinking') {
    if (waited >= LONGEST_MS) return { label: tr('Pensando com calma…', 'Taking time to think…') }
    if (waited >= LONG_MS) return { label: tr('Ainda pensando…', 'Still thinking…') }
    return { label }
  }
  if (waited >= LONGEST_MS) return { label: tr('Mais um pouco, obrigado pela paciência…', 'A bit longer, thanks for your patience…') }
  if (waited >= LONG_MS) return { label: tr('Ainda trabalhando nisso…', 'Still working on it…') }
  if (waited >= FIRST_PHRASE_MS) return { label: WAITING[Math.abs(Math.floor(since)) % WAITING.length]() }
  return { label }
}
