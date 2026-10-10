import type { DesignSummary } from '../../../../shared/design'
import type { SessionSummary } from '../../../../shared/sessions'
import type { ConversationSummary } from '../types'

// Conversas e designs lidos do disco como itens da lista da pasta (sem React e sem IPC).

function toConversation(s: SessionSummary): ConversationSummary {
  return {
    id: s.id,
    title: s.title,
    kind: 'conversa',
    status: s.live ?? 'idle',
    updatedAt: s.updatedAt,
    contextPercent: s.contextPercent,
    sessionId: s.id,
    ...(s.design && { design: true })
  }
}

// Cada design da pasta é uma conversa do modo design: o id leva "design:" para abrir o drawer dele.
export const DESIGN_PREFIX = 'design:'

function designToConversation(d: DesignSummary): ConversationSummary {
  return {
    id: DESIGN_PREFIX + d.id,
    title: d.name,
    kind: 'design',
    status: d.live ?? 'idle',
    updatedAt: d.updatedAt,
    contextPercent: 0,
    designId: d.id,
    // A conversa do protótipo: os agentes dela aparecem embaixo do item, como numa conversa comum.
    ...(d.sessionId && { sessionId: d.sessionId })
  }
}

// A lista da pasta, da mais recente para a mais antiga: a pilha do card e o painel de todas as
// conversas contam com essa ordem e não ordenam de novo.
export function folderList(sessions: SessionSummary[], designs: DesignSummary[]): ConversationSummary[] {
  return [...sessions.map(toConversation), ...designs.map(designToConversation)].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  )
}
