import { useEffect, useState } from 'react'
import type { ConversationSummary, ProjectData } from '../canvas/types'
import { useTheme } from '../theme/useTheme'
import { ConversationWindow } from './ConversationWindow'

export type PopoutPayload = {
  project: ProjectData
  conversation: ConversationSummary
}

// Janela própria de uma conversa (aberta pelo botão ↗ do painel).
export function PopoutApp({ id }: { id: string }) {
  const [payload, setPayload] = useState<PopoutPayload | null>(null)
  useTheme()

  useEffect(() => {
    window.api.popout.payload(id).then((p) => setPayload((p as PopoutPayload) ?? null))
  }, [id])

  useEffect(() => {
    if (payload) document.title = payload.conversation.title
  }, [payload])

  if (!payload) return null

  return (
    <div className="relative h-full">
      <ConversationWindow
        project={payload.project}
        conversation={payload.conversation}
        onClose={() => window.close()}
      />
    </div>
  )
}
