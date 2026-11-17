import { ExternalLink, Folder, MessageCircle, PanelRight, Pencil, Trash2, X } from 'lucide-react';
import type { MenuItem } from '../ContextMenu';
import { removeNode, setNoteColor } from '../operations';
import { projectTargets } from '../operations/projectDrop';
import type { ChatNode, ChatPanelNode, NoteNode, TerminalNode } from '../types';
import { renameItem } from './conversation';
import { boardSubmenu, moveSubmenu, type MoveDeps } from './shared';
import type { Deps } from './types';
import { tr } from '../../i18n';

// Menus dos blocos soltos que não são pasta nem grupo: terminal, conversa sem projeto,
// conversa aberta no canvas e nota.

export function terminalMenu(deps: Pick<Deps, 'startRename' | 'closeTerminal' | 'moveToBoard'>, node: TerminalNode): MenuItem[] {
  return [
    { type: 'action', label: tr('Renomear', 'Rename'), icon: Pencil, onSelect: () => deps.startRename(node.id) },
    boardSubmenu(deps, node),
    { type: 'separator' },
    {
      type: 'action',
      label: tr('Fechar terminal', 'Close terminal'),
      icon: Trash2,
      danger: true,
      onSelect: () => deps.closeTerminal(node.id, node.data.name),
    },
  ];
}

// Conversa sem projeto: sair do canvas não apaga a conversa, que continua salva no Claude Code.
export function chatMenu(deps: MoveDeps & Pick<Deps, 'openConversation' | 'confirm' | 'moveToProject'>, node: ChatNode): MenuItem[] {
  const { setNodes } = deps;
  return [
    {
      type: 'action',
      label: tr('Abrir conversa', 'Open chat'),
      icon: MessageCircle,
      onSelect: () => deps.openConversation(node.id, node.data.sessionId),
    },
    renameItem(deps, node.data.path, { id: node.data.sessionId, sessionId: node.data.sessionId }, 'card'),
    { type: 'separator' },
    projectSubmenu(deps, node),
    moveSubmenu(deps, node),
    boardSubmenu(deps, node),
    { type: 'separator' },
    {
      type: 'action',
      label: tr('Tirar do canvas', 'Remove from canvas'),
      icon: Trash2,
      danger: true,
      onSelect: () =>
        deps.confirm({
          title: tr('Tirar a conversa do canvas?', 'Remove the chat from the canvas?'),
          description: tr(
            'O card sai do canvas. A conversa continua salva no Claude Code.',
            'The card leaves the canvas. The chat stays saved in Claude Code.',
          ),
          confirmLabel: tr('Tirar do canvas', 'Remove from canvas'),
          onConfirm: () => setNodes((ns) => removeNode(ns, node.id)),
        }),
    },
  ];
}

// "Mover para projeto": as pastas do canvas. A conversa deixa de ser solta e vai para a lista da pasta.
function projectSubmenu(deps: Pick<Deps, 'nodes' | 'moveToProject'>, node: ChatNode): MenuItem {
  const items: MenuItem[] = projectTargets(deps.nodes, node).map((p) => ({
    type: 'action',
    label: p.data.name,
    dot: p.data.color,
    onSelect: () => deps.moveToProject(node.id, p.id),
  }));
  if (items.length === 0) items.push({ type: 'action', label: tr('Nenhuma pasta no canvas', 'No folders on the canvas'), disabled: true, onSelect: () => {} });
  return { type: 'submenu', label: tr('Mover para projeto', 'Move to project'), icon: Folder, items };
}

// Conversa no canvas: fechar só tira o bloco, sem perguntar, como o X do painel lateral.
export function chatPanelMenu(
  deps: MoveDeps & Pick<Deps, 'chatPanelToDrawer' | 'chatPanelPopout' | 'closeChatPanel'>,
  node: ChatPanelNode,
): MenuItem[] {
  return [
    { type: 'action', label: tr('Voltar para o painel lateral', 'Move back to side panel'), icon: PanelRight, onSelect: () => deps.chatPanelToDrawer(node.id) },
    { type: 'action', label: tr('Abrir em janela separada', 'Open in separate window'), icon: ExternalLink, onSelect: () => deps.chatPanelPopout(node.id) },
    { type: 'separator' },
    moveSubmenu(deps, node),
    boardSubmenu(deps, node),
    { type: 'separator' },
    { type: 'action', label: tr('Fechar conversa', 'Close chat'), icon: X, onSelect: () => deps.closeChatPanel(node.id) },
  ];
}

// Nota: excluir não pergunta, porque ⌘Z traz de volta.
export function noteMenu(deps: MoveDeps & Pick<Deps, 'startRename'>, node: NoteNode): MenuItem[] {
  const { setNodes } = deps;
  return [
    {
      type: 'colors',
      label: tr('Cor', 'Color'),
      value: node.data.color,
      onSelect: (color) => setNodes((ns) => setNoteColor(ns, node.id, color)),
    },
    { type: 'separator' },
    { type: 'action', label: tr('Editar nota', 'Edit note'), icon: Pencil, onSelect: () => deps.startRename(node.id) },
    moveSubmenu(deps, node),
    boardSubmenu(deps, node),
    { type: 'separator' },
    {
      type: 'action',
      label: tr('Excluir nota', 'Delete note'),
      icon: Trash2,
      danger: true,
      onSelect: () => setNodes((ns) => removeNode(ns, node.id)),
    },
  ];
}
