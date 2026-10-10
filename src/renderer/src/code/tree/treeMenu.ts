import { ClipboardPaste, Copy, FilePlus, FolderPlus, FolderSearch, Link, Pencil, Trash2 } from 'lucide-react'
import type { FileEntry } from '../../../../shared/files'
import type { MenuItem } from '../../canvas/ContextMenu'
import { FILE_MANAGER } from '../../platform'
import { parentOf } from './treePaths'

export type TreeMenuActions = {
  create: (dir: string, isDir: boolean) => void
  copy: (path: string) => void
  paste: (dir: string) => void
  copyPath: (path: string) => void
  rename: (path: string) => void
  reveal: (path: string) => void
  remove: (entry: FileEntry) => void
}

// Menu do botão direito na árvore: num item, ou no vazio (entry nulo: vale para a raiz). Criar e
// colar vão para a pasta do item (ou a do arquivo).
export function treeMenu(entry: FileEntry | null, a: TreeMenuActions): MenuItem[] {
  const dir = entry ? (entry.isDir ? entry.path : parentOf(entry.path)) : ''
  const items: MenuItem[] = [
    { type: 'action', label: 'Novo arquivo', icon: FilePlus, onSelect: () => a.create(dir, false) },
    { type: 'action', label: 'Nova pasta', icon: FolderPlus, onSelect: () => a.create(dir, true) },
    { type: 'separator' }
  ]
  if (entry) items.push({ type: 'action', label: 'Copiar', icon: Copy, onSelect: () => a.copy(entry.path) })
  items.push({ type: 'action', label: 'Colar', icon: ClipboardPaste, onSelect: () => a.paste(dir) })
  if (entry) {
    items.push(
      { type: 'separator' },
      { type: 'action', label: 'Copiar caminho relativo', icon: Link, onSelect: () => a.copyPath(entry.path) },
      { type: 'action', label: 'Renomear', icon: Pencil, onSelect: () => a.rename(entry.path) }
    )
  }
  items.push({ type: 'action', label: `Mostrar no ${FILE_MANAGER}`, icon: FolderSearch, onSelect: () => a.reveal(entry?.path ?? '') })
  if (entry) items.push({ type: 'separator' }, { type: 'action', label: 'Excluir', icon: Trash2, danger: true, onSelect: () => a.remove(entry) })
  return items
}
