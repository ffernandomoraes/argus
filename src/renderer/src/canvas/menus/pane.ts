import { FolderPlus, Folders, LayoutGrid, MessageCirclePlus, SquareDashed, StickyNote } from 'lucide-react'
import type { XYPosition } from '@xyflow/react'
import type { MenuItem } from '../ContextMenu'
import { terminalSubmenu } from './shared'
import type { Deps } from './types'
import { tr } from '../../i18n'

type PaneDeps = Pick<Deps, 'addNote' | 'newLooseConversation' | 'addTerminal' | 'addFolder' | 'addWorkspace' | 'addGroup' | 'organizeBoard'>

// Botão direito num lugar vazio do canvas: o bloco novo nasce ali.
export function paneMenu(deps: PaneDeps, position: XYPosition): MenuItem[] {
  // Mesma ordem do menu da pasta: nota; conversa e terminal; e o que organiza o canvas.
  return [
    { type: 'action', label: tr('Adicionar nota', 'Add note'), icon: StickyNote, shortcut: 'C', onSelect: () => deps.addNote(position) },
    { type: 'separator' },
    { type: 'action', label: tr('Nova conversa', 'New chat'), icon: MessageCirclePlus, shortcut: '⌘N', onSelect: () => deps.newLooseConversation(position) },
    terminalSubmenu(tr('Novo terminal', 'New terminal'), (kind, account) => deps.addTerminal(position, undefined, undefined, kind, account)),
    { type: 'separator' },
    { type: 'action', label: tr('Nova pasta', 'New folder'), icon: FolderPlus, shortcut: '⌘P', onSelect: () => deps.addFolder(position) },
    { type: 'action', label: tr('Novo espaço de trabalho', 'New workspace'), icon: Folders, onSelect: () => deps.addWorkspace(position) },
    { type: 'action', label: tr('Criar grupo', 'Create group'), icon: SquareDashed, shortcut: '⌘G', onSelect: () => deps.addGroup(position) },
    { type: 'separator' },
    { type: 'action', label: tr('Organizar board', 'Organize board'), icon: LayoutGrid, onSelect: deps.organizeBoard }
  ]
}
