import { FolderInput, FolderOpen, SquareTerminal, Terminal } from 'lucide-react'
import { ClaudeIcon } from '../../icons/ClaudeIcon'
import type { MenuItem } from '../ContextMenu'
import { moveToGroup } from '../operations'
import type { AreaNode, CanvasNode, ConversationSummary, TerminalKind } from '../types'
import type { Deps } from './types'
import { IS_WIN } from '../../platform'
import { tr } from '../../i18n'

// Peças repetidas nos menus do canvas.

// A Lixeira em inglês: no Windows, Recycle Bin.
export const TRASH_EN = IS_WIN ? 'Recycle Bin' : 'Trash'

// Rodando ou esperando resposta: tirar do canvas ou apagar agora atropelaria a sessão.
export const isBusy = (c: ConversationSummary) => c.status === 'running' || c.status === 'needs-you'

// "Novo terminal ▸ Claude Code / Shell": os dois abrem na mesma pasta e no mesmo lugar.
export function terminalSubmenu(label: string, open: (kind: TerminalKind) => void): MenuItem {
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

export type MoveDeps = Pick<Deps, 'nodes' | 'setNodes' | 'leaveGroup'>

// "Mover para grupo": os outros grupos e, se já estiver num, a saída dele.
export function moveSubmenu(deps: MoveDeps, node: CanvasNode): MenuItem {
  const { setNodes } = deps
  const groups = deps.nodes.filter((n): n is AreaNode => n.type === 'area' && n.id !== node.parentId)

  const moveItems: MenuItem[] = groups.map((g) => ({
    type: 'action',
    label: g.data.label,
    onSelect: () => setNodes((ns) => moveToGroup(ns, node.id, g.id))
  }))
  if (moveItems.length === 0) {
    moveItems.push({ type: 'action', label: tr('Nenhum outro grupo', 'No other groups'), disabled: true, onSelect: () => {} })
  }
  if (node.parentId) {
    moveItems.push(
      { type: 'separator' },
      {
        type: 'action',
        label: tr('Tirar do grupo', 'Remove from group'),
        icon: FolderOpen,
        onSelect: () => deps.leaveGroup(node.id)
      }
    )
  }
  return { type: 'submenu', label: tr('Mover para grupo', 'Move to group'), icon: FolderInput, items: moveItems }
}
