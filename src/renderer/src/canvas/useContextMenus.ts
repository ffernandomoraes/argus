import type { Dispatch, SetStateAction } from 'react'
import { ChevronDown, ChevronUp, FolderInput, Fullscreen, FolderOpen, Pencil, FolderPlus, SquareDashed, SquareTerminal, Trash2, Ungroup } from 'lucide-react'
import type { XYPosition } from '@xyflow/react'
import type { ConfirmRequest } from './ConfirmDialog'
import type { MenuItem } from './ContextMenu'
import { childrenOf, fitGroupToContent, moveToGroup, removeGroup, removeNode, setGroupColor, ungroup } from './operations'
import type { AreaNode, CanvasNode, ProjectNode, TerminalNode } from './types'

type Deps = {
  nodes: CanvasNode[]
  setNodes: Dispatch<SetStateAction<CanvasNode[]>>
  confirm: (req: ConfirmRequest) => void
  startRename: (id: string) => void
  addGroup: (position: XYPosition) => void
  addFolder: (position: XYPosition, groupId?: string) => void
  // folder vazio = pergunta a pasta; sessionId retoma uma conversa.
  addTerminal: (position: XYPosition, groupId?: string, folder?: string, sessionId?: string, name?: string) => void
  closeTerminal: (nodeId: string, name: string) => void
  recentConversations: (path: string) => { id: string; title: string }[]
  toggleGroup: (id: string) => void
}

const plural = (n: number) => (n === 1 ? '1 instância' : `${n} instâncias`)

// Pasta de um grupo, para o terminal já abrir no lugar certo.
function folderOf(nodes: CanvasNode[], groupId: string): string | undefined {
  return nodes.find((n): n is ProjectNode => n.parentId === groupId && n.type === 'project')?.data.path
}

export function paneMenu(deps: Deps, position: XYPosition): MenuItem[] {
  return [
    { type: 'action', label: 'Criar grupo', icon: SquareDashed, onSelect: () => deps.addGroup(position) },
    { type: 'action', label: 'Nova pasta', icon: FolderPlus, onSelect: () => deps.addFolder(position) },
    { type: 'action', label: 'Novo terminal', icon: SquareTerminal, onSelect: () => deps.addTerminal(position) }
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
    {
      type: 'action',
      label: 'Novo terminal',
      icon: SquareTerminal,
      // Dentro de um grupo com pastas, abre na primeira delas; senão pergunta.
      onSelect: () => deps.addTerminal(group.position, group.id, folderOf(deps.nodes, group.id))
    },
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

export function instanceMenu(deps: Deps, node: ProjectNode): MenuItem[] {
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

  // Retomar uma conversa desta pasta num terminal do canvas.
  const conversations = deps.recentConversations(node.data.path)
  const resumeItems: MenuItem[] = conversations.length
    ? conversations.map((c) => ({
        type: 'action',
        label: c.title,
        onSelect: () => deps.addTerminal(node.position, node.parentId, node.data.path, c.id, c.title)
      }))
    : [{ type: 'action', label: 'Nenhuma conversa ainda', disabled: true, onSelect: () => {} }]

  return [
    {
      type: 'action',
      label: 'Novo terminal aqui',
      icon: SquareTerminal,
      onSelect: () => deps.addTerminal(node.position, node.parentId, node.data.path)
    },
    { type: 'submenu', label: 'Abrir conversa no terminal', icon: SquareTerminal, items: resumeItems },
    { type: 'separator' },
    { type: 'submenu', label: 'Mover para grupo', icon: FolderInput, items: moveItems },
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
