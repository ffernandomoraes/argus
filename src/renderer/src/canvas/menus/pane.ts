import { FolderPlus, LayoutGrid, MessageCirclePlus, SquareDashed, StickyNote } from 'lucide-react'
import type { XYPosition } from '@xyflow/react'
import type { MenuItem } from '../ContextMenu'
import { terminalSubmenu } from './shared'
import type { Deps } from './types'

type PaneDeps = Pick<Deps, 'addNote' | 'newLooseConversation' | 'addTerminal' | 'addFolder' | 'addGroup' | 'organizeBoard'>

// Botão direito num lugar vazio do canvas: o bloco novo nasce ali.
export function paneMenu(deps: PaneDeps, position: XYPosition): MenuItem[] {
  // Mesma ordem do menu da pasta: nota; conversa e terminal; e o que organiza o canvas.
  return [
    { type: 'action', label: 'Adicionar nota', icon: StickyNote, onSelect: () => deps.addNote(position) },
    { type: 'separator' },
    { type: 'action', label: 'Nova conversa', icon: MessageCirclePlus, onSelect: () => deps.newLooseConversation(position) },
    terminalSubmenu('Novo terminal', (kind) => deps.addTerminal(position, undefined, undefined, kind)),
    { type: 'separator' },
    { type: 'action', label: 'Nova pasta', icon: FolderPlus, onSelect: () => deps.addFolder(position) },
    { type: 'action', label: 'Criar grupo', icon: SquareDashed, onSelect: () => deps.addGroup(position) },
    { type: 'separator' },
    { type: 'action', label: 'Organizar board', icon: LayoutGrid, onSelect: deps.organizeBoard }
  ]
}
