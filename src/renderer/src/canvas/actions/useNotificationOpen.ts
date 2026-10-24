import { useEffect } from 'react'
import { revealEnd } from '../../conversation/revealEnd'
import { useStableCallback } from '../../lib/useStableCallback'
import { boardList, currentBoard, switchBoard, takePendingOpen } from '../boards'
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

// Clique na notificação do sistema (ou numa linha do indicador de conversas ativas): abre a conversa
// pelo bloco dela (conversa solta) ou pelo projeto da pasta. Já aberta num drawer, fica nele e vai
// para o fim, onde está a resposta que avisou. Fora deste workspace e dentro de outro, a janela
// troca para ele e o canvas de lá abre a conversa ao montar.
// Devolve a mesma função, para quem mais abre conversas por pasta e sessão.
export function useNotificationOpen({ nodesRef, shown, openConversation }: Options): (cwd: string, sessionId: string) => void {
  const open = useStableCallback((cwd: string, sessionId: string) => {
    if (shown.some((a) => a && (a.conversationId === sessionId || a.sessionId === sessionId))) return revealEnd(sessionId)
    const path = displayPath(cwd)
    const target = ownerOf(nodesRef.current, path, sessionId)
    if (target) return openConversation(target.id, sessionId)
    const here = currentBoard()
    const other = boardList().find((b) => b.id !== here && (b.sessions.includes(sessionId) || b.paths.includes(path)))
    if (other) switchBoard(other.id, { cwd, sessionId })
  })

  useEffect(() => window.api.chat.onOpen(open), [open])
  // Conversa pedida no workspace anterior, que trocou para este.
  useEffect(() => {
    const pending = takePendingOpen()
    if (pending) open(pending.cwd, pending.sessionId)
  }, [open])
  return open
}
