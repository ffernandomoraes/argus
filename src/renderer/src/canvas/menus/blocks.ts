import { ExternalLink, MessageCircle, PanelRight, Pencil, Trash2, X } from 'lucide-react'
import type { MenuItem } from '../ContextMenu'
import { removeNode, setNoteColor } from '../operations'
import type { ChatNode, ChatPanelNode, NoteNode, TerminalNode } from '../types'
import { moveSubmenu, type MoveDeps } from './shared'
import type { Deps } from './types'

// Menus dos blocos soltos que não são pasta nem grupo: terminal, conversa sem projeto,
// conversa aberta no canvas e nota.

export function terminalMenu(deps: Pick<Deps, 'startRename' | 'closeTerminal'>, node: TerminalNode): MenuItem[] {
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
export function chatMenu(deps: MoveDeps & Pick<Deps, 'openConversation' | 'confirm'>, node: ChatNode): MenuItem[] {
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

// Conversa no canvas: fechar só tira o bloco, sem perguntar, como o X do painel lateral.
export function chatPanelMenu(
  deps: MoveDeps & Pick<Deps, 'chatPanelToDrawer' | 'chatPanelPopout' | 'closeChatPanel'>,
  node: ChatPanelNode
): MenuItem[] {
  return [
    { type: 'action', label: 'Voltar para o painel lateral', icon: PanelRight, onSelect: () => deps.chatPanelToDrawer(node.id) },
    { type: 'action', label: 'Abrir em janela separada', icon: ExternalLink, onSelect: () => deps.chatPanelPopout(node.id) },
    { type: 'separator' },
    moveSubmenu(deps, node),
    { type: 'separator' },
    { type: 'action', label: 'Fechar conversa', icon: X, onSelect: () => deps.closeChatPanel(node.id) }
  ]
}

// Nota: excluir não pergunta, porque ⌘Z traz de volta.
export function noteMenu(deps: MoveDeps & Pick<Deps, 'startRename'>, node: NoteNode): MenuItem[] {
  const { setNodes } = deps
  return [
    {
      type: 'colors',
      label: 'Cor',
      value: node.data.color,
      onSelect: (color) => setNodes((ns) => setNoteColor(ns, node.id, color))
    },
    { type: 'separator' },
    { type: 'action', label: 'Editar nota', icon: Pencil, onSelect: () => deps.startRename(node.id) },
    moveSubmenu(deps, node),
    { type: 'separator' },
    {
      type: 'action',
      label: 'Excluir nota',
      icon: Trash2,
      danger: true,
      onSelect: () => setNodes((ns) => removeNode(ns, node.id))
    }
  ]
}
