import type { Dispatch, SetStateAction } from 'react'
import { ChevronDown, ChevronUp, FolderInput, Fullscreen, FolderOpen, MessageCircle, MessageCirclePlus, Pencil, FolderPlus, SquareDashed, SquareTerminal, Terminal, Trash2, Ungroup } from 'lucide-react'
import type { XYPosition } from '@xyflow/react'
import type { ConfirmRequest } from './ConfirmDialog'
import type { MenuItem } from './ContextMenu'
import { childrenOf, fitGroupToContent, moveToGroup, removeGroup, removeNode, setGroupColor, ungroup } from './operations'
import { ClaudeIcon } from '../icons/ClaudeIcon'
import type { AreaNode, CanvasNode, ChatNode, ProjectNode, TerminalKind, TerminalNode } from './types'

type Deps = {
  nodes: CanvasNode[]
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
  confirm: (req: ConfirmRequest) => void
  startRename: (id: string) => void
  addGroup: (position: XYPosition) => void
  addFolder: (position: XYPosition, groupId?: string) => void
  // folder vazio = pasta do usuário.
  addTerminal: (position: XYPosition, groupId?: string, folder?: string, kind?: TerminalKind) => void
  closeTerminal: (nodeId: string, name: string) => void
  toggleGroup: (id: string) => void
  newLooseConversation: (position?: XYPosition) => void
  openConversation: (nodeId: string, conversationId: string) => void
}

const plural = (n: number) => (n === 1 ? '1 instância' : `${n} instâncias`)

// Pasta de um grupo, para o terminal já abrir no lugar certo.
function folderOf(nodes: CanvasNode[], groupId: string): string | undefined {
  return nodes.find((n): n is ProjectNode => n.parentId === groupId && n.type === 'project')?.data.path
}

// "Novo terminal ▸ Claude Code / Shell": os dois abrem na mesma pasta e no mesmo lugar.
function terminalSubmenu(label: string, open: (kind: TerminalKind) => void): MenuItem {
  return {
    type: 'submenu',
    label,
    icon: SquareTerminal,
    items: [
      { type: 'action', label: 'Claude Code', icon: ClaudeIcon, onSelect: () => open('claude') },
      { type: 'action', label: 'Shell', icon: Terminal, onSelect: () => open('shell') }
    ]
  }
}

export function paneMenu(deps: Deps, position: XYPosition): MenuItem[] {
  return [
    { type: 'action', label: 'Criar grupo', icon: SquareDashed, onSelect: () => deps.addGroup(position) },
    { type: 'action', label: 'Nova pasta', icon: FolderPlus, onSelect: () => deps.addFolder(position) },
    { type: 'action', label: 'Nova conversa', icon: MessageCirclePlus, onSelect: () => deps.newLooseConversation(position) },
    terminalSubmenu('Novo terminal', (kind) => deps.addTerminal(position, undefined, undefined, kind))
  ]
}

export function groupMenu(deps: Deps, group: AreaNode): MenuItem[] {
  const { setNodes } = deps
  const count = childrenOf(deps.nodes, group.id).length

  return [
    {
      type: 'colors',
      label: 'Cor',
      value: group.data.color,
      onSelect: (color) => setNodes((ns) => setGroupColor(ns, group.id, color))
    },
    { type: 'separator' },
    {
      type: 'action',
      label: 'Nova pasta',
      icon: FolderPlus,
      onSelect: () => deps.addFolder(group.position, group.id)
    },
    // Dentro de um grupo com pastas, abre na primeira delas; senão na pasta do usuário.
    terminalSubmenu('Novo terminal', (kind) =>
      deps.addTerminal(group.position, group.id, folderOf(deps.nodes, group.id), kind)
    ),
    { type: 'separator' },
    {
      type: 'action',
      label: group.data.collapsed ? 'Expandir grupo' : 'Recolher grupo',
      icon: group.data.collapsed ? ChevronDown : ChevronUp,
      onSelect: () => deps.toggleGroup(group.id)
    },
    {
      type: 'action',
      label: 'Ajustar ao conteúdo',
      icon: Fullscreen,
      disabled: count === 0 || !!group.data.collapsed,
      onSelect: () => setNodes((ns) => fitGroupToContent(ns, group.id))
    },
    { type: 'action', label: 'Renomear grupo', icon: Pencil, onSelect: () => deps.startRename(group.id) },
    { type: 'separator' },
    {
      type: 'action',
      label: 'Desagrupar tudo',
      icon: Ungroup,
      disabled: count === 0,
      onSelect: () => setNodes((ns) => ungroup(ns, group.id))
    },
    { type: 'separator' },
    {
      type: 'action',
      label: 'Excluir grupo',
      icon: Trash2,
      danger: true,
      onSelect: () =>
        deps.confirm({
          title: `Excluir o grupo "${group.data.label}"?`,
          description:
            count > 0
              ? `${plural(count)} dentro dele também ${count === 1 ? 'será excluída' : 'serão excluídas'}. Para mantê-las, use "Desagrupar tudo" antes.`
              : 'O grupo está vazio.',
          confirmLabel: 'Excluir grupo',
          onConfirm: () => setNodes((ns) => removeGroup(ns, group.id))
        })
    }
  ]
}

// "Mover para grupo": os outros grupos e, se já estiver num, a saída dele.
function moveSubmenu(deps: Deps, node: CanvasNode): MenuItem {
  const { setNodes } = deps
  const groups = deps.nodes.filter((n): n is AreaNode => n.type === 'area' && n.id !== node.parentId)

  const moveItems: MenuItem[] = groups.map((g) => ({
    type: 'action',
    label: g.data.label,
    onSelect: () => setNodes((ns) => moveToGroup(ns, node.id, g.id))
  }))
  if (moveItems.length === 0) {
    moveItems.push({ type: 'action', label: 'Nenhum outro grupo', disabled: true, onSelect: () => {} })
  }
  if (node.parentId) {
    moveItems.push(
      { type: 'separator' },
      {
        type: 'action',
        label: 'Tirar do grupo',
        icon: FolderOpen,
        onSelect: () => setNodes((ns) => moveToGroup(ns, node.id, null))
      }
    )
  }
  return { type: 'submenu', label: 'Mover para grupo', icon: FolderInput, items: moveItems }
}

export function instanceMenu(deps: Deps, node: ProjectNode): MenuItem[] {
  const { setNodes } = deps
  return [
    terminalSubmenu('Novo terminal aqui', (kind) => deps.addTerminal(node.position, node.parentId, node.data.path, kind)),
    { type: 'separator' },
    moveSubmenu(deps, node),
    { type: 'action', label: 'Renomear', icon: Pencil, onSelect: () => deps.startRename(node.id) },
    { type: 'separator' },
    {
      type: 'action',
      label: 'Excluir',
      icon: Trash2,
      danger: true,
      onSelect: () =>
        deps.confirm({
          title: `Excluir "${node.data.name}"?`,
          description: 'A instância sai do canvas.',
          confirmLabel: 'Excluir',
          onConfirm: () => setNodes((ns) => removeNode(ns, node.id))
        })
    }
  ]
}

export function terminalMenu(deps: Deps, node: TerminalNode): MenuItem[] {
  return [
    { type: 'action', label: 'Renomear', icon: Pencil, onSelect: () => deps.startRename(node.id) },
    { type: 'separator' },
    {
      type: 'action',
      label: 'Fechar terminal',
      icon: Trash2,
      danger: true,
      onSelect: () => deps.closeTerminal(node.id, node.data.name)
    }
  ]
}

// Conversa sem projeto: sair do canvas não apaga a conversa, que continua salva no Claude Code.
export function chatMenu(deps: Deps, node: ChatNode): MenuItem[] {
  const { setNodes } = deps
  return [
    {
      type: 'action',
      label: 'Abrir conversa',
      icon: MessageCircle,
      onSelect: () => deps.openConversation(node.id, node.data.sessionId)
    },
    { type: 'separator' },
    moveSubmenu(deps, node),
    { type: 'separator' },
    {
      type: 'action',
      label: 'Tirar do canvas',
      icon: Trash2,
      danger: true,
      onSelect: () =>
        deps.confirm({
          title: 'Tirar a conversa do canvas?',
          description: 'O card sai do canvas. A conversa continua salva no Claude Code.',
          confirmLabel: 'Tirar do canvas',
          onConfirm: () => setNodes((ns) => removeNode(ns, node.id))
        })
    }
  ]
}
