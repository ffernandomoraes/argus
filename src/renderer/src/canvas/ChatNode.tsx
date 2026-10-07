import type { NodeProps } from '@xyflow/react'
import { useCanvasActions } from './CanvasContext'
import { ConversationItem, useNow } from './ConversationItem'
import { CHAT_SIZE } from './factory'
import { useSessions } from './sessionsStore'
import type { ChatNode as ChatNodeType, ConversationSummary } from './types'

// Conversa sem projeto, solta no canvas: o mesmo card das conversas embaixo da pasta.
// Título, status e "há 2h" vêm do arquivo da sessão; clicar reabre no painel lateral.
export function ChatNode({ id, data }: NodeProps<ChatNodeType>) {
  const sessions = useSessions(data.path)
  const now = useNow()
  const { activeConversation, openConversation, poppedOut } = useCanvasActions()

  // Logo depois do primeiro envio, a sessão ainda não entrou na lista da pasta.
  const conversation: ConversationSummary = sessions.find((s) => s.id === data.sessionId) ?? {
    id: data.sessionId,
    title: data.name,
    kind: 'conversa',
    status: 'running',
    updatedAt: new Date(now).toISOString(),
    contextPercent: 0,
    sessionId: data.sessionId
  }

  return (
    <ul style={{ width: CHAT_SIZE.width }}>
      <ConversationItem
        conversation={conversation}
        active={activeConversation?.nodeId === id}
        poppedOut={poppedOut.has(data.sessionId)}
        now={now}
        card
        draggable
        onOpen={() => openConversation(id, data.sessionId)}
      />
    </ul>
  )
}
