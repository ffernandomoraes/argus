import { useState, type MouseEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Folder, FolderOpen, Folders } from 'lucide-react'
import { ContextMenu, type MenuState } from '../../canvas/ContextMenu'
import { baseName, FILE_MANAGER } from '../../platform'
import { TAG } from './BranchTag'
import { tr } from '../../i18n'

// Selo da pasta da conversa. Botão direito: abrir a pasta no Finder (no Windows, no Explorador de
// Arquivos). Workspace (folders): ícone de várias pastas, e o menu abre cada uma.
export function FolderTag({ cwd, folders, children }: { cwd: string; folders?: string[]; children: ReactNode }) {
  const [menu, setMenu] = useState<MenuState | null>(null)

  const showMenu = (e: MouseEvent) => {
    // Sem subir: no canvas, o card do chat abriria o menu dele junto.
    e.preventDefault()
    e.stopPropagation()
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: folders
        ? folders.map((f) => ({
            type: 'action' as const,
            label: tr(`Abrir ${baseName(f)} no ${FILE_MANAGER}`, `Open ${baseName(f)} in ${FILE_MANAGER}`),
            icon: FolderOpen,
            onSelect: () => window.api.files.openFolder(f)
          }))
        : [{ type: 'action', label: tr(`Abrir no ${FILE_MANAGER}`, `Open in ${FILE_MANAGER}`), icon: FolderOpen, onSelect: () => window.api.files.openFolder(cwd) }]
    })
  }

  return (
    <>
      <span onContextMenu={showMenu} title={folders?.join('\n')} className={`${TAG} no-drag nodrag min-w-0 gap-1`}>
        {folders ? <Folders size={12} className="shrink-0" /> : <Folder size={12} className="shrink-0" />}
        <span className="truncate">{children}</span>
        {folders && (
          <span className="shrink-0 text-faint">
            - {folders.length === 1 ? tr('1 pasta', '1 folder') : tr(`${folders.length} pastas`, `${folders.length} folders`)}
          </span>
        )}
      </span>
      {/* No body: dentro do canvas o `fixed` seguiria o zoom e o deslocamento dele. */}
      {menu && createPortal(<ContextMenu menu={menu} onClose={() => setMenu(null)} />, document.body)}
    </>
  )
}
