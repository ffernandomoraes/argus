import { useEffect, useState } from 'react'
import type { ConversationSummary, ProjectData } from '../canvas/types'
import { useTheme } from '../theme/useTheme'
import { ConversationDrawer } from './ConversationDrawer'
import type { SessionSettings } from './SessionSettings'

export type PopoutPayload = {
  project: ProjectData
  conversation: ConversationSummary
  settings: SessionSettings
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

  const onSettingsChange = (settings: SessionSettings) => {
    setPayload({ ...payload, settings })
    window.api.popout.sendSettings(id, settings)
  }

  return (
    <div className="relative h-full">
      <ConversationDrawer
        variant="window"
        project={payload.project}
        conversation={payload.conversation}
        settings={payload.settings}
        onSettingsChange={onSettingsChange}
        codeOpen={false}
        onToggleCode={() => {}}
        onClose={() => window.close()}
      />
    </div>
  )
}
