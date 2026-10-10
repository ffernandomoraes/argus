import { useMemo, useState } from 'react'
import { useSessions } from '../sessionsStore'
import type { ConversationSummary, SessionStatus } from '../types'

const nowIso = () => new Date().toISOString()

// Conversa de um bloco do canvas (card solto ou conversa no canvas), lida da lista da pasta.
// Logo depois do primeiro envio, ou ao abrir o app, ela pode ainda não estar na lista: até lá
// vale uma reserva com o nome guardado no nó e o status de quem chama.
export function useConversationSummary(
  path: string,
  sessionId: string,
  name: string,
  status: SessionStatus
): ConversationSummary {
  const sessions = useSessions(path)
  // Hora da reserva fixa desde a montagem: com a hora de agora, ela mudava a cada minuto e o
  // histórico da conversa era relido junto (o updatedAt é o que manda reler).
  const [since] = useState(nowIso)
  const found = sessions.find((s) => s.id === sessionId)
  return useMemo(
    () =>
      found ?? {
        id: sessionId,
        title: name,
        kind: 'conversa',
        status,
        updatedAt: since,
        contextPercent: 0,
        sessionId
      },
    [found, sessionId, name, status, since]
  )
}
