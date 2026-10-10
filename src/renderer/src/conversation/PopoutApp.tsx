import { useEffect, useState } from 'react'
import { useSessions } from '../canvas/sessionsStore'
import type { ConversationSummary, ProjectData } from '../canvas/types'
import { useTheme } from '../theme/useTheme'
import { ConversationWindow } from './ConversationWindow'

export type PopoutPayload = {
  project: ProjectData
  conversation: ConversationSummary
  // Conta do grupo da pasta quando a janela abriu.
  account?: string
}

const closeWindow = () => window.close()

// Janela própria de uma conversa (aberta pelo botão ↗ do painel).
export function PopoutApp({ id }: { id: string }) {
  const [payload, setPayload] = useState<PopoutPayload | null>(null)
  useTheme()

  useEffect(() => {
    let alive = true
    window.api.popout.payload(id).then(
      (p) => {
        if (alive) setPayload((p as PopoutPayload) ?? null)
      },
      () => {}
    )
    return () => {
      alive = false
    }
  }, [id])

  if (!payload) return null
  return <PopoutConversation payload={payload} />
}

// O payload é a foto da conversa quando a janela abriu: status, título e contexto vêm da lista da
// pasta, que segue atualizando aqui (antes, a conversa rodando no terminal ficava "Trabalhando…"
// para sempre). Fora da lista ainda (acabou de abrir), vale a foto.
function PopoutConversation({ payload }: { payload: PopoutPayload }) {
  const sessions = useSessions(payload.project.path)
  const conversation = sessions.find((c) => c.id === payload.conversation.id) ?? payload.conversation

  useEffect(() => {
    document.title = conversation.title
  }, [conversation.title])

  return (
    <div className="relative h-full">
      <ConversationWindow project={payload.project} account={payload.account} conversation={conversation} onClose={closeWindow} />
    </div>
  )
}
