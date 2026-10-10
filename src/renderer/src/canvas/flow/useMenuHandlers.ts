import { useCallback, type Dispatch, type MouseEvent as ReactMouseEvent, type SetStateAction } from 'react'
import { useReactFlow, type NodeMouseHandler } from '@xyflow/react'
import { useAuth } from '../../auth/useAuth'
import { useStableCallback } from '../../lib/useStableCallback'
import type { NodesApi } from '../actions/types'
import type { MenuState } from '../ContextMenu'
import type { CanvasNode, ConversationSummary, ProjectNode } from '../types'
import {
  chatMenu,
  chatPanelMenu,
  conversationMenu,
  groupMenu,
  instanceMenu,
  noteMenu,
  paneMenu,
  terminalMenu,
  type Deps
} from '../menus'

// Tudo o que os menus podem fazer, menos a lista de nós e as contas, lidas na hora do clique.
type MenuDeps = Omit<Deps, 'nodes' | 'auth'>

type Options = {
  nodesRef: NodesApi['nodesRef']
  setMenu: Dispatch<SetStateAction<MenuState | null>>
  deps: MenuDeps
}

// Menus de botão direito: do canvas vazio, de cada bloco e de uma conversa da lista da pasta.
// As funções não mudam de identidade (o React Flow repassa o onNodeContextMenu a cada nó, e uma
// função nova a cada render redesenhava todos), e cada menu é montado com o estado da hora do clique.
export function useMenuHandlers({ nodesRef, setMenu, deps }: Options) {
  const { screenToFlowPosition } = useReactFlow()
  const auth = useAuth()
  const currentDeps = useStableCallback((): Deps => ({ ...deps, nodes: nodesRef.current, auth }))

  const onPaneContextMenu = useCallback(
    (e: ReactMouseEvent | MouseEvent) => {
      e.preventDefault()
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      setMenu({ x: e.clientX, y: e.clientY, items: paneMenu(currentDeps(), position) })
    },
    [screenToFlowPosition, setMenu, currentDeps]
  )

  // O menu da pasta abre na hora. "Abrir no GitHub" depende do remoto do git (dois comandos em
  // série): entra quando ele responder, e só se esse menu ainda for o aberto.
  const openProjectMenu = useCallback(
    (e: ReactMouseEvent, node: ProjectNode) => {
      const { clientX: x, clientY: y } = e
      const at = screenToFlowPosition({ x, y })
      const opened: MenuState = { x, y, items: instanceMenu(currentDeps(), node, null, at) }
      setMenu(opened)
      window.api.sessions
        .repoUrl(node.data.path)
        .then((url) => {
          if (!url) return
          setMenu((menu) => (menu === opened ? { ...opened, items: instanceMenu(currentDeps(), node, url, at) } : menu))
        })
        .catch(() => {})
    },
    [screenToFlowPosition, setMenu, currentDeps]
  )

  const onNodeContextMenu = useCallback<NodeMouseHandler<CanvasNode>>(
    (e, node) => {
      e.preventDefault()
      if (node.type === 'project') return openProjectMenu(e, node)
      const d = currentDeps()
      const items =
        node.type === 'area'
          ? groupMenu(d, node)
          : node.type === 'terminal'
            ? terminalMenu(d, node)
            : node.type === 'chat'
              ? chatMenu(d, node)
              : node.type === 'note'
                ? noteMenu(d, node)
                : chatPanelMenu(d, node)
      setMenu({ x: e.clientX, y: e.clientY, items })
    },
    [openProjectMenu, setMenu, currentDeps]
  )

  // Botão direito numa conversa da lista da pasta: menu dela, não o da pasta.
  const openConversationMenu = useCallback(
    (e: ReactMouseEvent, nodeId: string, conversation: ConversationSummary) => {
      e.preventDefault()
      // Sem isso, o botão direito sobe até a pasta e abre o menu dela.
      e.stopPropagation()
      const node = nodesRef.current.find((n) => n.id === nodeId)
      if (node?.type !== 'project') return
      setMenu({ x: e.clientX, y: e.clientY, items: conversationMenu(currentDeps(), node, conversation) })
    },
    [nodesRef, setMenu, currentDeps]
  )

  return { onPaneContextMenu, onNodeContextMenu, openConversationMenu }
}
