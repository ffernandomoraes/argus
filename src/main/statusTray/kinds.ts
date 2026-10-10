import type { ChatState } from '../../shared/chat'

// Estado de cada conversa como o ícone e o menu mostram.
export type Kind = 'running' | 'needs-you' | 'done' | 'error' | 'idle'
// Conversa que terminou com você fora do app: fica marcada até você voltar.
export type Finished = { cwd: string; sessionId?: string; kind: 'done' | 'error' }

export const LABEL: Record<Kind, string> = {
  running: 'Processando',
  'needs-you': 'Precisa de você',
  done: 'Concluído',
  error: 'Parou com erro',
  idle: 'Parado'
}

// O mais urgente vale para o ícone da barra.
export const PRIORITY: Kind[] = ['needs-you', 'running', 'error', 'done', 'idle']

export function kindOf(state: ChatState, finished?: Finished): Kind {
  if (state.status === 'needs-you') return 'needs-you'
  if (state.status === 'running') return 'running'
  return finished?.kind ?? 'idle'
}

export const topKind = (kinds: Kind[]): Kind => PRIORITY.find((k) => kinds.includes(k)) ?? 'idle'

// Texto ao parar o mouse no ícone: quantas conversas em cada estado.
export function tooltip(appName: string, kinds: Kind[]): string {
  const counts = PRIORITY.filter((k) => k !== 'idle')
    .map((k) => [k, kinds.filter((x) => x === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${LABEL[k].toLowerCase()}`)
  return `${appName}: ${counts.length ? counts.join(', ') : 'nada rodando'}`
}
