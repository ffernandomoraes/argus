import { memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { sameNodeProps } from './blocks/sameNodeProps'
import { useConversationSummary } from './blocks/useConversationSummary'
import { useCanvasActions } from './CanvasContext'
import { ConversationItem } from './ConversationItem'
import { CHAT_SIZE } from './factory'
import type { ChatNode as ChatNodeType } from './types'
import { useActiveConversationIn, useIsPoppedOut } from './useCanvasView'

// Conversa sem projeto, solta no canvas: o mesmo card das conversas embaixo da pasta.
// Título, status e "há 2h" vêm do arquivo da sessão; clicar reabre no painel lateral.
function ChatNodeView({ id, data }: NodeProps<ChatNodeType>) {
  // Logo depois do primeiro envio, a sessão ainda não entrou na lista da pasta: conta como rodando.
  const conversation = useConversationSummary(data.path, data.sessionId, data.name, 'running')
  const { openConversation } = useCanvasActions()
  const active = !!useActiveConversationIn(id)
  const poppedOut = useIsPoppedOut(data.sessionId)

  return (
    <ul style={{ width: CHAT_SIZE.width }}>
      <ConversationItem
        conversation={conversation}
        active={active}
        poppedOut={poppedOut}
        card
        draggable
        onOpen={() => openConversation(id, data.sessionId)}
      />
    </ul>
  )
}

export const ChatNode = memo(ChatNodeView, sameNodeProps)
