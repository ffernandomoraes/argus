import { memo, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import type { ResolvedTheme } from '../theme/useTheme'
import type { NodesApi } from './actions/types'
import { useArrange } from './actions/useArrange'
import { useCanvasCommands } from './actions/useCanvasCommands'
import { useConversationActions } from './actions/useConversationActions'
import { useLooseCards } from './actions/useLooseCards'
import { useNodeActions } from './actions/useNodeActions'
import { useNotificationOpen } from './actions/useNotificationOpen'
import { usePoppedOut } from './actions/usePoppedOut'
import { CanvasContext } from './CanvasContext'
import { CanvasViewContext, createCanvasView, patchView } from './canvasView'
import { CanvasOverlays } from './drawers/CanvasOverlays'
import { DrawerHost } from './drawers/DrawerHost'
import { drawerLayout } from './drawers/drawerLayout'
import { designView, slotTarget } from './drawers/drawerView'
import { useCanvasProjects } from './drawers/useCanvasProjects'
import { useDrawers } from './drawers/useDrawers'
import { useOverlays } from './drawers/useOverlays'
import { useShownDrawers } from './drawers/useShownDrawers'
import { CanvasFlow } from './flow/CanvasFlow'
import { useGroupDrop } from './flow/useGroupDrop'
import { useMenuHandlers } from './flow/useMenuHandlers'
import { useCliOpen } from './focus/useCliOpen'
import { useFocusNode } from './focus/useFocusNode'
import { useCanvasKeys } from './keys/useCanvasKeys'
import { useSpaceHeld } from './keys/useSpaceHeld'
import { useUiHidden } from './keys/useUiHidden'
import { loadNodes, useCanvasSync } from './persistence'
import { RunningIndicator } from './RunningIndicator'
import { setPoppedOut } from './sessionsStore'
import { TitleBar } from './TitleBar'
import type { CanvasNode } from './types'
import { useCanvasAgentTools } from './useCanvasAgentTools'
import { useHistory } from './useHistory'

type Props = { colorMode: ResolvedTheme; onOpenSettings: () => void }

// O canvas: a lista de nós (salva, sincronizada entre as janelas e com desfazer) e o que se monta
// em volta dela. Cada parte mora numa pasta: flow/ (o React Flow), actions/ (o que os blocos e os
// menus pedem), drawers/ (drawers, painéis e modais por cima), keys/ (teclado) e focus/ (câmera).
function CanvasView({ colorMode, onOpenSettings }: Props) {
  const [nodes, setNodes] = useState<CanvasNode[]>(loadNodes)
  const { nodesRef, change, trackGesture, undo, redo } = useHistory(nodes, setNodes)
  useCanvasSync(nodes, setNodes)
  useCanvasAgentTools(nodesRef, change)
  const api = useMemo<NodesApi>(() => ({ nodesRef, setNodes, change }), [nodesRef, change])
  // Câmera com que esta janela estava ao fechar o app; sem ela, enquadra tudo.
  const [savedViewport] = useState(() => window.api.canvas.viewport())

  // O que os blocos mostram e muda com o uso (canvasView.ts): lido por bloco, fora do contexto.
  const [view] = useState(createCanvasView)
  const overlays = useOverlays()
  const drawers = useDrawers()
  const shownDrawers = useShownDrawers()
  const markPoppedOut = usePoppedOut(view)
  const isPoppedOut = (id: string) => view.get().poppedOut.has(id)
  // Conversa em janela separada está sendo vista: a resposta dela não fica como não lida.
  useEffect(() => {
    let last = view.get().poppedOut
    setPoppedOut(last)
    return view.subscribe(() => {
      const now = view.get().poppedOut
      if (now !== last) setPoppedOut((last = now))
    })
  }, [view])
  const focusNode = useFocusNode(api)
  const nodeActions = useNodeActions(api, view, overlays.commands.confirm)
  const { arranging, organizeBoard, organizeGroup } = useArrange(api)
  const watchLoose = useLooseCards(api, drawers.commands)
  const conversations = useConversationActions({
    api,
    view,
    focusNode,
    drawers: drawers.commands,
    markPoppedOut,
    watchLoose,
    confirm: overlays.commands.confirm
  })
  const drop = useGroupDrop(api, view)
  const menus = useMenuHandlers({
    nodesRef,
    setMenu: overlays.commands.setMenu,
    deps: {
      ...nodeActions,
      ...conversations,
      setNodes: change,
      confirm: overlays.commands.confirm,
      addFolder: overlays.commands.addFolder,
      isPoppedOut,
      organizeBoard,
      organizeGroup
    }
  })
  const commands = useCanvasCommands({
    nodeActions,
    conversations,
    overlays: overlays.commands,
    openConversationMenu: menus.openConversationMenu,
    openSettings: onOpenSettings
  })

  const spaceHeld = useSpaceHeld()
  const { uiHidden, toggleUi } = useUiHidden()
  useCanvasKeys({
    nodesRef,
    change,
    undo,
    redo,
    addNote: nodeActions.addNote,
    openCommandBar: overlays.commands.openCommandBar,
    closeMenu: overlays.commands.closeMenu
  })
  useCliOpen(api, focusNode)
  const { main, second } = drawers.state
  const openChat = useNotificationOpen({ nodesRef, shown: [main, second], openConversation: conversations.openConversation })
  // A conversa e o design abertos vão para o store, onde cada bloco lê se é o dele.
  const activeDesign = drawers.state.design
  useLayoutEffect(() => patchView(view, { activeConversation: main, activeDesign }), [view, main, activeDesign])

  const targets = useMemo(() => ({ main: slotTarget(nodes, main), second: slotTarget(nodes, second) }), [nodes, main, second])
  const design = useMemo(() => designView(nodes, drawers.state.design), [nodes, drawers.state.design])
  const layout = drawerLayout(drawers.state, targets, shownDrawers.titles)
  const { shown } = layout
  const projects = useCanvasProjects(nodes)
  // Pasta do painel de todas as conversas; some junto com a pasta, se ela for excluída.
  const listId = overlays.state.allConversations
  const allConversations = useMemo(() => {
    const node = nodes.find((n) => n.id === listId)
    return node?.type === 'project' ? node : null
  }, [nodes, listId])

  return (
    <CanvasContext.Provider value={commands}>
      <CanvasViewContext.Provider value={view}>
        <CanvasFlow
          nodes={nodes}
          nodesRef={nodesRef}
          setNodes={setNodes}
          trackGesture={trackGesture}
          onNodeDrag={drop.onNodeDrag}
          onNodeDragStop={drop.onNodeDragStop}
          onPaneContextMenu={menus.onPaneContextMenu}
          onNodeContextMenu={menus.onNodeContextMenu}
          onMoveStart={overlays.commands.closeMenu}
          colorMode={colorMode}
          savedViewport={savedViewport}
          spaceHeld={spaceHeld}
          uiHidden={uiHidden}
          arranging={arranging}
          zoomShortcuts={!shown}
        />
        {/* Escurece levemente o canvas com um painel aberto; não bloqueia cliques */}
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-30 bg-black transition-opacity duration-200 ${
            shown || allConversations || design ? 'opacity-[0.22] [[data-theme=light]_&]:opacity-[0.12]' : 'opacity-0'
          }`}
        />
        {/* Na janela (menu Janela, Mission Control), a conversa aberta e o projeto; sem conversa, o nome do app. */}
        <RunningIndicator hidden={uiHidden} onOpen={openChat} />
        <TitleBar
          windowTitle={
            shown ? `${shown.title} - ${shown.target.project.name}` : design ? `Design - ${design.projectName}` : 'Argus'
          }
          uiHidden={uiHidden}
          onToggleUi={toggleUi}
        />
        <DrawerHost
          state={drawers.state}
          targets={targets}
          design={design}
          layout={layout}
          commands={drawers.commands}
          actions={conversations}
          onShown={shownDrawers.report}
        />
        <CanvasOverlays
          state={overlays.state}
          commands={overlays.commands}
          projects={projects}
          allConversations={allConversations}
          memoryProject={shown && !shown.target.loose ? shown.target.project.path : undefined}
          openConversation={conversations.openConversation}
          newConversation={conversations.newConversation}
          change={change}
        />
      </CanvasViewContext.Provider>
    </CanvasContext.Provider>
  )
}

export const Canvas = memo(CanvasView)
