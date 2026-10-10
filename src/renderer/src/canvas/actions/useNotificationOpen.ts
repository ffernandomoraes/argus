import { useEffect, useEffectEvent } from 'react'
import type { ActiveConversation } from '../CanvasContext'
import { displayPath } from '../factory'
import { ownerOf } from './lookup'
import type { NodesApi } from './types'

type Options = {
  nodesRef: NodesApi['nodesRef']
  // Conversas nos drawers agora.
  shown: (ActiveConversation | null)[]
  openConversation: (nodeId: string, conversationId: string) => void
}

// Clique na notificação do sistema: abre a conversa pelo bloco dela (conversa solta) ou pelo
// projeto da pasta. Já aberta num drawer, fica como está.
export function useNotificationOpen({ nodesRef, shown, openConversation }: Options): void {
  const open = useEffectEvent((cwd: string, sessionId: string) => {
    if (shown.some((a) => a && (a.conversationId === sessionId || a.sessionId === sessionId))) return
    const target = ownerOf(nodesRef.current, displayPath(cwd), sessionId)
    if (target) openConversation(target.id, sessionId)
  })

  useEffect(() => window.api.chat.onOpen((cwd, sessionId) => open(cwd, sessionId)), [])
}
