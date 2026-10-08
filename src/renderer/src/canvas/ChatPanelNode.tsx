import { NodeResizer, useNodesData, type NodeProps } from '@xyflow/react'
import { ExternalLink, PanelRight } from 'lucide-react'
import { ConversationView, HeaderButton } from '../conversation/ConversationView'
import { useCanvasActions } from './CanvasContext'
import { useNow } from './ConversationItem'
import { useSessions } from './sessionsStore'
import type { AreaNode, ChatPanelNode as ChatPanelNodeType, ConversationSummary } from './types'

// A conversa morando no canvas, como o terminal: o mesmo chat do painel lateral, num bloco que
// acompanha o zoom. Arrasta pelo cabeçalho; no corpo, dá para selecionar texto e rolar o chat.
export function ChatPanelNode({ id, data, selected, parentId }: NodeProps<ChatPanelNodeType>) {
  const sessions = useSessions(data.path)
  const now = useNow()
  // Conta do grupo onde o bloco está. Vale ao abrir a sessão, como no painel.
  const group = useNodesData<AreaNode>(parentId ?? '')
  const account = group?.type === 'area' ? group.data.account : undefined
  const { closeChatPanel, chatPanelToDrawer, chatPanelPopout, openFileFrom } = useCanvasActions()
  const project = { name: data.projectName ?? 'Sem projeto', path: data.path, color: '#71717a' }

  // A conversa já existe (só entra no canvas depois do primeiro envio), mas pode demorar a
  // aparecer na lista da pasta ao abrir o app.
  const conversation: ConversationSummary = sessions.find((s) => s.id === data.sessionId) ?? {
    id: data.sessionId,
    title: data.name,
    kind: 'conversa',
    status: 'idle',
    updatedAt: new Date(now).toISOString(),
    contextPercent: 0,
    sessionId: data.sessionId
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={360}
        minHeight={320}
        lineStyle={{ borderColor: 'var(--color-line-strong)' }}
        handleStyle={{ background: 'var(--color-muted)', border: 'none', width: 8, height: 8 }}
      />
      {/* nowheel: rolar em cima do bloco rola o chat, não o canvas */}
      <div
        className="nowheel relative flex h-full flex-col overflow-hidden rounded-xl border bg-bg shadow-lg shadow-black/30"
        style={{ borderColor: selected ? 'var(--color-accent)' : 'var(--color-line)' }}
      >
        <ConversationView
          cwd={data.path}
          account={account}
          project={data.projectName}
          conversation={conversation}
          onOpenFile={(path, lines) => openFileFrom(project, path, lines)}
          onOpenDiff={(path) => openFileFrom(project, path, undefined, true)}
          // chat-panel-drag: o cabeçalho é a alça do bloco (dragHandle, em createChatPanel).
          headerClassName="chat-panel-drag cursor-grab bg-surface-2 active:cursor-grabbing"
          bodyClassName="nodrag nopan select-text"
          actions={
            <>
              <HeaderButton label="Voltar para o painel lateral" onClick={() => chatPanelToDrawer(id)}>
                <PanelRight size={14} />
              </HeaderButton>
              <HeaderButton label="Abrir em janela separada" onClick={() => chatPanelPopout(id)}>
                <ExternalLink size={14} />
              </HeaderButton>
            </>
          }
          onClose={() => closeChatPanel(id)}
        />
      </div>
    </>
  )
}
