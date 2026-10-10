import type { RunningAgent } from '../../../../shared/agents'
import type { ConversationSummary } from '../types'
import { ROW_GAP, ROW_HEIGHT } from './geometry'

// As conversas mais recentes ficam como linhas dentro da caixa da pasta; todas abrem pelo
// botão no fim da lista, no painel flutuante.
export const MAX_CONVERSATIONS = 3

// Recolhida, a pasta ainda mostra o que pede atenção, para nenhum aviso sumir junto.
const isActive = (c: ConversationSummary) => c.status === 'running' || c.status === 'needs-you'

// As que aparecem na caixa. A lista já vem da mais recente para a mais antiga (sessionsStore).
export function visibleConversations(conversations: ConversationSummary[], collapsed: boolean): ConversationSummary[] {
  return (collapsed ? conversations.filter(isActive) : conversations).slice(0, MAX_CONVERSATIONS)
}

// Conversas na ordem da lista, cada uma seguida dos subagentes que ela tem rodando agora.
export type Row =
  | { kind: 'conversation'; conversation: ConversationSummary }
  | { kind: 'agent'; agent: RunningAgent; conversation: ConversationSummary; first: boolean }

// Chave dos subagentes de uma conversa da lista. Design: os agentes são da conversa do protótipo
// dele (a sessão), não do item da lista; sem sessão ainda, nenhuma ('').
export const agentsKeyOf = (conversation: ConversationSummary): string =>
  (conversation.kind === 'design' ? conversation.sessionId : conversation.id) ?? ''

export function withAgents(
  conversations: ConversationSummary[],
  agentsOf: (key: string) => RunningAgent[]
): Row[] {
  const rows: Row[] = []
  for (const conversation of conversations) {
    rows.push({ kind: 'conversation', conversation })
    const key = agentsKeyOf(conversation)
    const agents = key ? agentsOf(key) : []
    // O primeiro subagente da conversa puxa a linha do ícone dela; os outros, do anterior.
    agents.forEach((agent, i) => rows.push({ kind: 'agent', agent, conversation, first: i === 0 }))
  }
  return rows
}

// Meio de cada conversa na lista, para as perninhas, e se ela está rodando (perninha animada).
export function legsOf(rows: Row[]): { middle: number; running: boolean }[] {
  const legs: { middle: number; running: boolean }[] = []
  let top = 0
  for (const row of rows) {
    if (row.kind === 'conversation') {
      legs.push({ middle: top + ROW_HEIGHT.conversation / 2, running: row.conversation.status === 'running' })
    }
    top += ROW_HEIGHT[row.kind] + ROW_GAP
  }
  return legs
}
