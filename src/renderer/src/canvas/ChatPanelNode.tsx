import { memo, useCallback, useMemo, useRef } from 'react'
import type { NodeProps } from '@xyflow/react'
import { ExternalLink, PanelRight, Star, StarOff } from 'lucide-react'
import { askColors } from '../conversation/askColors'
import { CodeTerminalButtons } from '../conversation/composer/CodeTerminalButtons'
import { ConversationView } from '../conversation/ConversationView'
import { DrawerTerminal, useDrawerShell } from '../conversation/DrawerTerminal'
import type { LineRange } from '../conversation/fileLinks'
import { MoreMenu } from '../conversation/header/MoreMenu'
import { useStableCallback } from '../lib/useStableCallback'
import { BlockFrame } from './blocks/BlockFrame'
import { sameNodeProps } from './blocks/sameNodeProps'
import { useConversationSummary } from './blocks/useConversationSummary'
import { useGroupOf } from './blocks/useGroupOf'
import { useCanvasActions } from './CanvasContext'
import { favoriteKey, setFavorite, useFavorites } from './favorites'
import type { ChatPanelNode as ChatPanelNodeType } from './types'
import { useIsCodeOpen, useIsNewBlock } from './useCanvasView'
import { tr } from '../i18n'

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
  const { closeChatPanel, chatPanelToDrawer, chatPanelPopout, openFileFrom, openPlanFrom, toggleProjectCode } = useCanvasActions()

  // Tudo fixo enquanto a pasta não muda: o ConversationView é memorizado, e arrastar o bloco não
  // pode redesenhar a conversa.
  const { projectName, path, folders } = data
  const project = useMemo(
    () => ({
      name: projectName ?? tr('Sem projeto', 'No project'),
      path,
      color: '#71717a',
      ...(folders && { folders })
    }),
    [projectName, path, folders]
  )
  const onOpenFile = useCallback((file: string, lines?: LineRange) => openFileFrom(project, file, lines), [openFileFrom, project])
  const onOpenDiff = useCallback((file: string) => openFileFrom(project, file, undefined, true), [openFileFrom, project])
  const onClose = useCallback(() => closeChatPanel(id), [closeChatPanel, id])
  // Mesmo menu de mais opções do drawer, com o que faz sentido para o bloco.
  const key = favoriteKey(conversation)
  const favorite = useFavorites().has(key ?? '')
  // Estável: a conversa muda a cada passo do Claude e redesenharia o cabeçalho à toa.
  const toggleFavorite = useStableCallback(() => setFavorite(conversation, !favorite))
  const actions = useMemo(
    () => (
      <MoreMenu
        items={[
          ...(key
            ? [
                favorite
                  ? {
                      label: tr('Remover dos favoritos', 'Remove from favorites'),
                      icon: StarOff,
                      onClick: toggleFavorite
                    }
                  : {
                      label: tr('Favoritar', 'Add to favorites'),
                      icon: Star,
                      onClick: toggleFavorite
                    }
              ]
            : []),
          {
            label: tr('Voltar para o painel lateral', 'Move back to side panel'),
            icon: PanelRight,
            onClick: () => chatPanelToDrawer(id)
          },
          {
            label: tr('Abrir em janela separada', 'Open in separate window'),
            icon: ExternalLink,
            onClick: () => chatPanelPopout(id)
          }
        ]}
      />
    ),
    [key, favorite, toggleFavorite, chatPanelToDrawer, chatPanelPopout, id]
  )

  // Código e terminal em cima da caixa de escrever, como no drawer. Sem projeto ou no workspace,
  // não tem um código da pasta para abrir (o do workspace abre pelo link de cada arquivo).
  const codeOpen = useIsCodeOpen(path)
  const hasCode = !!projectName && !folders
  const onToggleCode = useCallback(() => toggleProjectCode(project, codeOpen), [toggleProjectCode, project, codeOpen])
  const shell = useDrawerShell(conversation)
  const composerAboveEnd = useMemo(
    () => (
      <CodeTerminalButtons
        codeOpen={codeOpen}
        onToggleCode={hasCode ? onToggleCode : undefined}
        terminalOpen={shell.open}
        onToggleTerminal={shell.toggle}
      />
    ),
    [codeOpen, hasCode, onToggleCode, shell.open, shell.toggle]
  )
  const areaRef = useRef<HTMLDivElement>(null)

  const style = useMemo(() => (tint ? askColors(tint) : undefined), [tint])

  return (
    // nowheel: rolar em cima do bloco rola o chat, não o canvas
    <BlockFrame selected={selected} minHeight={320} className="nowheel relative bg-bg" style={style}>
      <div ref={areaRef} className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col">
          <ConversationView
            cwd={data.path}
            folders={folders}
            account={account}
            project={data.projectName}
            conversation={conversation}
            onOpenFile={onOpenFile}
            onOpenPlan={openPlanFrom}
            onOpenDiff={onOpenDiff}
            // chat-panel-drag: o cabeçalho é a alça do bloco (dragHandle, em createChatPanel).
            headerClassName="chat-panel-drag cursor-grab bg-surface-2 active:cursor-grabbing"
            bodyClassName="nodrag nopan select-text"
            actions={actions}
            composerAboveEnd={composerAboveEnd}
            autoFocus={isNew}
            onClose={onClose}
          />
        </div>
        {shell.open && (
          <DrawerTerminal
            sessionKey={shell.key}
            // Workspace: o shell abre na primeira pasta dele (a do workspace em si é só um id).
            cwd={folders?.[0] ?? path}
            account={account}
            fontScale={1}
            ratio={shell.ratio}
            onRatioChange={shell.setRatio}
            areaRef={areaRef}
            // Dentro do terminal, o mouse seleciona texto em vez de arrastar o bloco ou o canvas.
            className="nodrag nopan"
          />
        )}
      </div>
    </BlockFrame>
  )
}

export const ChatPanelNode = memo(ChatPanelNodeView, sameNodeProps)
