import type { ChatState } from '../../shared/chat'

// Estado de cada conversa como o ícone e o menu mostram.
export type Kind = 'running' | 'needs-you' | 'done' | 'error' | 'idle'
// Conversa que parou com erro com você fora do app: fica marcada até você voltar. As que terminaram
// bem são as não vistas da janela (UnreadChat), que ficam até você abrir a conversa.
export type Finished = { cwd: string; sessionId?: string; kind: 'error' }

export const LABEL: Record<Kind, string> = {
  running: 'Processando',
  'needs-you': 'Precisa de você',
  done: 'Concluído',
  error: 'Parou com erro',
  idle: 'Parado'
}

// O mais urgente vale para o ícone da barra.
export const PRIORITY: Kind[] = ['needs-you', 'running', 'error', 'done', 'idle']

export function kindOf(state: ChatState, finished: Finished | undefined, unread: boolean): Kind {
  if (state.status === 'needs-you') return 'needs-you'
  if (state.status === 'running') return 'running'
  return finished?.kind ?? (unread ? 'done' : 'idle')
}

export const topKind = (kinds: Kind[]): Kind => PRIORITY.find((k) => kinds.includes(k)) ?? 'idle'

// Quantas conversas em cada estado ("2 processando, 1 concluído"); vazio sem nada acontecendo.
export function summary(kinds: Kind[]): string {
  return PRIORITY.filter((k) => k !== 'idle')
    .map((k) => [k, kinds.filter((x) => x === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${n} ${LABEL[k].toLowerCase()}`)
    .join(', ')
}

// Texto ao parar o mouse no ícone.
export function tooltip(appName: string, kinds: Kind[]): string {
  return `${appName}: ${summary(kinds) || 'nada rodando'}`
}
