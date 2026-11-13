import { useEffect, useMemo, useState } from 'react'
import type { ActiveConversation } from '../CanvasContext'
import { useSessionsOf } from '../sessionsStore'
import type { ConversationSummary } from '../types'
import { conversationOf, draftConversation, type SlotTarget } from './drawerView'

// Quanto o drawer segura a conversa que sumiu da lista (ver useHeld).
const HOLD_MS = 3000

// A conversa de um drawer, acompanhando só a lista da pasta dele. Nula se não há conversa aberta
// ou se ela saiu da lista (excluída): o DrawerHost tira o drawer e a saída anima, como antes.
export function useSlotConversation(
  active: ActiveConversation | null,
  target: SlotTarget | null
): ConversationSummary | null {
  const path = active ? target?.project.path : undefined
  const [sessions] = useSessionsOf(path ? [path] : [])
  const draft = useMemo(() => (active?.draft ? draftConversation(active) : null), [active])
  const found = active && target ? conversationOf(active, sessions ?? [], draft) : undefined
  return useHeld(found, active) ?? null
}

// O Claude levou a conversa para um worktree: o arquivo dela muda de pasta, e ela some da lista
// antes de o drawer passar para o card do worktree, onde a lista ainda vai ser lida (ver
// useWorktreeMoves). Nesse intervalo o drawer segue com ela, em vez de fechar e abrir de novo ou de
// mostrar o rascunho em branco. Sumida por mais tempo (excluída), sai.
function useHeld(found: ConversationSummary | undefined, active: ActiveConversation | null): ConversationSummary | undefined {
  const real = found && !found.draft ? found : undefined
  const [last, setLast] = useState(real)
  const [expired, setExpired] = useState(false)
  if (real && real !== last) {
    setLast(real)
    setExpired(false)
  }
  const same = !!last && !!active && (last.id === active.sessionId || last.id === active.conversationId)
  const holding = same && !real && !expired
  useEffect(() => {
    if (!holding) return
    const timer = setTimeout(() => setExpired(true), HOLD_MS)
    return () => clearTimeout(timer)
  }, [holding])
  return holding ? last : found
}
