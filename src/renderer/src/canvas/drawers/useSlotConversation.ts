import { useMemo } from 'react'
import type { ActiveConversation } from '../CanvasContext'
import { useSessionsOf } from '../sessionsStore'
import type { ConversationSummary } from '../types'
import { conversationOf, draftConversation, type SlotTarget } from './drawerView'

// A conversa de um drawer, acompanhando só a lista da pasta dele. Nula se não há conversa aberta
// ou se ela saiu da lista (excluída): o DrawerHost tira o drawer e a saída anima, como antes.
export function useSlotConversation(
  active: ActiveConversation | null,
  target: SlotTarget | null
): ConversationSummary | null {
  const path = active ? target?.project.path : undefined
  const [sessions] = useSessionsOf(path ? [path] : [])
  const draft = useMemo(() => (active?.draft ? draftConversation(active) : null), [active])
  if (!active || !target) return null
  return conversationOf(active, sessions ?? [], draft) ?? null
}
