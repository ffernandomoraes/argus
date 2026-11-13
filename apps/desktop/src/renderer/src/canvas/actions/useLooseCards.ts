import { useCallback, useEffect, useRef } from 'react'
import type { XYPosition } from '@xyflow/react'
import type { DrawerCommands } from '../drawers/useDrawers'
import { createChat } from '../factory'
import { findChatSpot } from '../operations'
import type { NodesApi } from './types'

// Conversa sem projeto entra no canvas como card quando o Claude dá o id da sessão (no primeiro
// envio), num lugar livre (onde o botão direito foi dado, se ele estiver livre). Acompanhado aqui,
// no Canvas, pelo estado do chat: antes era o drawer que criava o card, e se ele fechasse ou
// trocasse de conversa antes de a sessão começar, ninguém criava (a resposta ia só para o disco).
// Só as conversas abertas nesta janela: as outras janelas recebem o card pela sincronização.
export function useLooseCards({ nodesRef, change }: Pick<NodesApi, 'nodesRef' | 'change'>, drawers: DrawerCommands) {
  // Id provisório ("new-…") da conversa sem projeto ainda sem sessão → onde o card deve nascer.
  const pending = useRef(new Map<string, XYPosition | undefined>())

  useEffect(
    () =>
      window.api.chat.onState((key, state) => {
        const sessionId = state.sessionId
        if (!sessionId || !pending.current.has(key)) return
        const at = pending.current.get(key)
        pending.current.delete(key)
        // Por garantia: com o card da sessão já no canvas, usa o que existe.
        const existing = nodesRef.current.find((n) => n.type === 'chat' && n.data.sessionId === sessionId)
        const node = existing ?? createChat(findChatSpot(nodesRef.current, at), sessionId)
        if (!existing) change((ns) => [...ns, node])
        drawers.sessionStarted(key, sessionId, node.id)
      }),
    [nodesRef, change, drawers]
  )

  // Conversa sem projeto aberta em branco: passa a ser acompanhada até ganhar a sessão.
  return useCallback((conversationId: string, at?: XYPosition) => {
    pending.current.set(conversationId, at)
  }, [])
}
