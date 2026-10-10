import { memo, useCallback, useMemo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ExternalLink, PanelRight } from 'lucide-react'
import { askColors } from '../conversation/askColors'
import { ConversationView, HeaderButton } from '../conversation/ConversationView'
import type { LineRange } from '../conversation/fileLinks'
import { BlockFrame } from './blocks/BlockFrame'
import { sameNodeProps } from './blocks/sameNodeProps'
import { useConversationSummary } from './blocks/useConversationSummary'
import { useGroupOf } from './blocks/useGroupOf'
import { useCanvasActions } from './CanvasContext'
import type { ChatPanelNode as ChatPanelNodeType } from './types'
import { useIsNewBlock } from './useCanvasView'

// A conversa morando no canvas, como o terminal: o mesmo chat do painel lateral, num bloco que
// acompanha o zoom. Arrasta pelo cabeçalho; no corpo, dá para selecionar texto e rolar o chat.
function ChatPanelNodeView({ id, data, selected, parentId }: NodeProps<ChatPanelNodeType>) {
  // A conversa já existe (só entra no canvas depois do primeiro envio), mas pode demorar a
  // aparecer na lista da pasta ao abrir o app.
  const conversation = useConversationSummary(data.path, data.sessionId, data.name, 'idle')
  // Conta do grupo onde o bloco está (vale ao abrir a sessão, como no painel) e a cor dele, para
  // as perguntas e permissões no chat.
  const { account, color: tint } = useGroupOf(parentId)
  // Só o bloco que acabou de ser posto no canvas pega o foco: ao abrir o app, expandir o grupo ou
  // desfazer, a caixa de escrever não rouba as teclas do canvas.
  const isNew = useIsNewBlock(id)
  const { closeChatPanel, chatPanelToDrawer, chatPanelPopout, openFileFrom } = useCanvasActions()

  // Tudo fixo enquanto a pasta não muda: o ConversationView é memorizado, e arrastar o bloco não
  // pode redesenhar a conversa.
  const { projectName, path } = data
  const project = useMemo(() => ({ name: projectName ?? 'Sem projeto', path, color: '#71717a' }), [projectName, path])
  const onOpenFile = useCallback(
    (file: string, lines?: LineRange) => openFileFrom(project, file, lines),
    [openFileFrom, project]
  )
  const onOpenDiff = useCallback((file: string) => openFileFrom(project, file, undefined, true), [openFileFrom, project])
  const onClose = useCallback(() => closeChatPanel(id), [closeChatPanel, id])
  const actions = useMemo(
    () => (
      <>
        <HeaderButton label="Voltar para o painel lateral" onClick={() => chatPanelToDrawer(id)}>
          <PanelRight size={14} />
        </HeaderButton>
        <HeaderButton label="Abrir em janela separada" onClick={() => chatPanelPopout(id)}>
          <ExternalLink size={14} />
        </HeaderButton>
      </>
    ),
    [chatPanelToDrawer, chatPanelPopout, id]
  )
  const style = useMemo(() => (tint ? askColors(tint) : undefined), [tint])

  return (
    // nowheel: rolar em cima do bloco rola o chat, não o canvas
    <BlockFrame selected={selected} minHeight={320} className="nowheel relative bg-bg" style={style}>
      <ConversationView
        cwd={data.path}
        account={account}
        project={data.projectName}
        conversation={conversation}
        onOpenFile={onOpenFile}
        onOpenDiff={onOpenDiff}
        // chat-panel-drag: o cabeçalho é a alça do bloco (dragHandle, em createChatPanel).
        headerClassName="chat-panel-drag cursor-grab bg-surface-2 active:cursor-grabbing"
        bodyClassName="nodrag nopan select-text"
        actions={actions}
        autoFocus={isNew}
        onClose={onClose}
      />
    </BlockFrame>
  )
}

export const ChatPanelNode = memo(ChatPanelNodeView, sameNodeProps)
