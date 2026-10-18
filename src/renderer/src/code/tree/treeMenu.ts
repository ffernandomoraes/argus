import { ClipboardPaste, Copy, FilePlus, FolderPlus, FolderSearch, Globe, Link, Pencil, Trash2 } from 'lucide-react'
import type { FileEntry } from '../../../../shared/files'
import type { MenuItem } from '../../canvas/ContextMenu'
import { FILE_MANAGER } from '../../platform'
import { parentOf } from './treePaths'
import { tr } from '../../i18n'

export type TreeMenuActions = {
  create: (dir: string, isDir: boolean) => void
  copy: (path: string) => void
  paste: (dir: string) => void
  copyPath: (path: string) => void
  copyAbsolutePath: (path: string) => void
  rename: (path: string) => void
  reveal: (path: string) => void
  openInBrowser: (path: string) => void
  remove: (entry: FileEntry) => void
}

// O que o navegador mostra sozinho: página, PDF, imagem.
const BROWSER_FILE = /\.(html?|xhtml|pdf|svg|png|jpe?g|gif|webp|avif)$/i

// Menu do botão direito na árvore: num item, ou no vazio (entry nulo: vale para a raiz). Criar e
// colar vão para a pasta do item (ou a do arquivo).
export function treeMenu(entry: FileEntry | null, a: TreeMenuActions): MenuItem[] {
  const dir = entry ? (entry.isDir ? entry.path : parentOf(entry.path)) : ''
  const items: MenuItem[] = [
    { type: 'action', label: tr('Novo arquivo', 'New file'), icon: FilePlus, onSelect: () => a.create(dir, false) },
    { type: 'action', label: tr('Nova pasta', 'New folder'), icon: FolderPlus, onSelect: () => a.create(dir, true) },
    { type: 'separator' }
  ]
  if (entry) items.push({ type: 'action', label: tr('Copiar', 'Copy'), icon: Copy, onSelect: () => a.copy(entry.path) })
  items.push({ type: 'action', label: tr('Colar', 'Paste'), icon: ClipboardPaste, onSelect: () => a.paste(dir) })
  if (entry) {
    items.push(
      { type: 'separator' },
      { type: 'action', label: tr('Copiar caminho absoluto', 'Copy absolute path'), icon: Link, onSelect: () => a.copyAbsolutePath(entry.path) },
      { type: 'action', label: tr('Copiar caminho relativo', 'Copy relative path'), icon: Link, onSelect: () => a.copyPath(entry.path) },
      { type: 'action', label: tr('Renomear', 'Rename'), icon: Pencil, onSelect: () => a.rename(entry.path) }
    )
  }
  if (entry && !entry.isDir && BROWSER_FILE.test(entry.path))
    items.push({ type: 'action', label: tr('Abrir no navegador', 'Open in browser'), icon: Globe, onSelect: () => a.openInBrowser(entry.path) })
  items.push({ type: 'action', label: tr(`Mostrar no ${FILE_MANAGER}`, `Show in ${FILE_MANAGER}`), icon: FolderSearch, onSelect: () => a.reveal(entry?.path ?? '') })
  if (entry) items.push({ type: 'separator' }, { type: 'action', label: tr('Excluir', 'Delete'), icon: Trash2, danger: true, onSelect: () => a.remove(entry) })
  return items
}
