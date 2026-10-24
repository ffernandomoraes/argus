import { FolderInput, FolderOpen, Layers, SquareTerminal, Terminal } from 'lucide-react'
import { agentRef, parseAgentRef, PROVIDER_NAMES, PROVIDERS } from '../../../../shared/providers'
import { getAuth, resolveAccount } from '../../auth/useAuth'
import { getProviders } from '../../providers/useProviders'
import { AGENT_MENU_ICONS } from '../../icons/AgentIcon'
import { ClaudeIcon } from '../../icons/ClaudeIcon'
import { boardList, currentBoard } from '../boards'
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

// "Novo terminal ▸ Claude Code / Codex / … / Shell": todos os agentes conectados (e as contas de
// cada um), em qualquer lugar; o terminal guarda o escolhido. Abrem na mesma pasta e no mesmo lugar.
export function terminalSubmenu(label: string, open: (kind: TerminalKind, account?: string) => void, group?: string): MenuItem {
  const auth = getAuth()
  // Claude num grupo de outro agente: a conta padrão do Claude, não a do grupo.
  const claude = parseAgentRef(group) ? resolveAccount(auth, undefined) : group
  const items: MenuItem[] = [{ type: 'action', label: 'Claude Code', icon: ClaudeIcon, onSelect: () => open('claude', claude) }]
  const state = getProviders()
  for (const provider of PROVIDERS) {
    const accounts = state?.providers[provider].accounts ?? []
    if (!accounts.length) continue
    const name = PROVIDER_NAMES[provider]
    const icon = AGENT_MENU_ICONS[provider]
    items.push(
      accounts.length === 1
        ? { type: 'action', label: name, icon, onSelect: () => open('claude', agentRef(provider, accounts[0].id)) }
        : {
            type: 'submenu',
            label: name,
            icon,
            items: accounts.map((a) => ({ type: 'action', label: a.name, onSelect: () => open('claude', agentRef(provider, a.id)) }))
          }
    )
  }
  items.push({ type: 'action', label: 'Shell', icon: Terminal, onSelect: () => open('shell', group) })
  return { type: 'submenu', label, icon: SquareTerminal, items }
}

export type MoveDeps = Pick<Deps, 'nodes' | 'setNodes' | 'leaveGroup' | 'moveToBoard'>

// "Mover para grupo": os outros grupos e, se já estiver num, a saída dele.
export function moveSubmenu(deps: MoveDeps, node: CanvasNode): MenuItem {
  const { setNodes } = deps
  const groups = deps.nodes.filter((n): n is AreaNode => n.type === 'area' && n.id !== node.parentId)

  const moveItems: MenuItem[] = groups.map((g) => ({
    type: 'action',
    label: g.data.label,
    dot: g.data.color,
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

// "Mover para workspace": os outros workspaces abertos. O bloco leva junto o que está dentro dele (grupo) e
// as tarefas isoladas (pasta).
export function boardSubmenu(deps: Pick<Deps, 'moveToBoard'>, node: CanvasNode): MenuItem {
  const here = currentBoard()
  const items: MenuItem[] = boardList()
    .filter((b) => b.id !== here && !b.closed)
    .map((b) => ({ type: 'action', label: b.name, onSelect: () => deps.moveToBoard(node.id, b.id) }))
  if (items.length === 0) {
    items.push({ type: 'action', label: tr('Nenhum outro workspace', 'No other workspaces'), disabled: true, onSelect: () => {} })
  }
  return { type: 'submenu', label: tr('Mover para workspace', 'Move to workspace'), icon: Layers, items }
}
