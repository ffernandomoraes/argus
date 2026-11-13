import type { SessionSummary } from '@argus/shared/sessions'
import type { ConversationSummary } from '../types'

// Conversas lidas do disco como itens da lista da pasta (sem React e sem IPC).

function toConversation(s: SessionSummary): ConversationSummary {
  return {
    id: s.id,
    title: s.title,
    kind: 'conversa',
    status: s.live ?? 'idle',
    updatedAt: s.updatedAt,
    repliedAt: s.repliedAt,
    contextPercent: s.contextPercent,
    sessionId: s.id,
    ...(s.agent && { agent: s.agent })
  }
}

// A lista da pasta, da mais recente para a mais antiga: a pilha do card e o painel de todas as
// conversas contam com essa ordem e não ordenam de novo.
export function folderList(sessions: SessionSummary[]): ConversationSummary[] {
  return sessions.map(toConversation).sort((a, b) =>
    b.repliedAt.localeCompare(a.repliedAt)
  )
}
