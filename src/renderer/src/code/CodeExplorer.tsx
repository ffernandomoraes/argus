import { useMemo, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { FilePlus, Folder, FolderPlus, RefreshCw } from 'lucide-react'
import { ConfirmDialog } from '../canvas/ConfirmDialog'
import { ContextMenu } from '../canvas/ContextMenu'
import { useUncommitted } from '../canvas/sessionsStore'
import { PANEL_TOP } from '../conversation/FloatingPanel'
import { Presence } from '../motion'
import { IconButton } from '../ui/IconButton'
import { useEscape } from '../useEscape'
import { CloseCodeButton } from './CloseCodeButton'
import { useDraftPaths } from './drafts'
import { FileEscapeContext } from './fileEscape'
import { TreeList } from './tree/FileTree'
import { changesInTree } from './tree/treePaths'
import { useFileTree } from './tree/useFileTree'
import { useTreeActions } from './tree/useTreeActions'
import { WidthResizer } from '../ui/WidthResizer'
import { useWidth } from '../ui/widthStore'
import { treeWidth } from './treeWidth'
import { tr } from '../i18n'

// Painel de código: árvore de pastas e arquivos do projeto (carregada sob demanda) e, com um
// arquivo aberto, o conteúdo dele ao lado, no mesmo painel, que então se estica até a conversa.
// Na árvore dá para criar, renomear, excluir (vai para a Lixeira), copiar e colar, inclusive
// arquivos copiados no Finder: botão direito, os ícones do cabeçalho ou os atalhos.
export function CodeExplorer({
  root,
  name,
  selected,
  rightOffset,
  onOpenFile,
  onRenamed,
  onDeleted,
  onClose,
  children
}: {
  root: string
  name: string
  selected: string | null
  // Espaço ocupado pelo painel da conversa à direita; vale só com arquivo aberto.
  rightOffset: number | string
  onOpenFile: (path: string) => void
  // Item renomeado ou excluído: o arquivo aberto pode ser ele ou estar dentro dele.
  onRenamed: (from: string, to: string) => void
  onDeleted: (path: string) => void
  onClose: () => void
  // Arquivo aberto (FileViewer), mostrado à direita da árvore.
  children?: ReactNode
}) {
  const treeRef = useRef<HTMLDivElement>(null)
  const width = useWidth(treeWidth)
  const tree = useFileTree(root)
  const actions = useTreeActions({ root, tree, selected, treeRef, onOpenFile, onRenamed, onDeleted })
  const drafts = useDraftPaths(root)
  const uncommitted = useUncommitted(root)
  const changes = useMemo(() => changesInTree(root, uncommitted), [root, uncommitted])
  // Com arquivo aberto, o Esc fecha só ele (o FileViewer entrega como, ver fileEscape.ts).
  const closeFileRef = useRef<(() => void) | null>(null)
  useEscape(() => (closeFileRef.current ? closeFileRef.current() : onClose()))

  const { focused, editing } = actions
  const rootEntries = tree.listings['']

  return (
    <aside
      // Sem arquivo aberto, o painel acompanha a largura da árvore (arrastada pela borda).
      style={{ top: PANEL_TOP, ...(children ? { right: rightOffset } : {}) }}
      className="absolute bottom-2 left-2 z-40 flex overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/50"
    >
      <div style={{ width }} className={`relative flex shrink-0 flex-col ${children ? 'border-r border-line' : ''}`}>
        <header className="flex h-12 items-center gap-1 border-b border-line pr-3 pl-3">
          <Folder size={14} className="mr-1 shrink-0 text-muted" />
          <span className="flex-1 truncate text-sm font-medium">{name}</span>
          <IconButton label={tr('Novo arquivo', 'New file')} onClick={() => actions.startCreate(actions.targetDir(focused), false)}>
            <FilePlus size={14} />
          </IconButton>
          <IconButton label={tr('Nova pasta', 'New folder')} onClick={() => actions.startCreate(actions.targetDir(focused), true)}>
            <FolderPlus size={14} />
          </IconButton>
          <IconButton label={tr('Atualizar', 'Refresh')} onClick={tree.reloadAll}>
            <RefreshCw size={13} />
          </IconButton>
          {/* Com arquivo aberto, o X fica no canto do painel, no cabeçalho do arquivo. */}
          {!children && <CloseCodeButton onClick={onClose} />}
        </header>
        <div
          ref={treeRef}
          tabIndex={-1}
          onKeyDown={actions.onKeyDown}
          onContextMenu={(e) => actions.openMenu(e, null)}
          // Clicar no vazio tira o foco do item: criar e colar passam a valer para a raiz.
          onMouseDown={(e) => e.target === e.currentTarget && actions.setFocused(null)}
          className="min-h-0 flex-1 overflow-y-auto p-1.5 outline-none"
        >
          {!rootEntries && <p className="px-2 py-1 text-xs text-faint">{tr('Carregando…', 'Loading…')}</p>}
          {rootEntries?.length === 0 && !editing && <p className="px-2 py-1 text-xs text-faint">{tr('Pasta vazia ou inexistente', 'Empty or missing folder')}</p>}
          {rootEntries && (
            <TreeList
              dir=""
              entries={rootEntries}
              depth={0}
              listings={tree.listings}
              expanded={tree.expanded}
              focused={focused}
              drafts={drafts}
              changes={changes}
              editing={editing}
              onClick={actions.onItemClick}
              onContextMenu={actions.onItemMenu}
              onSubmitEdit={actions.onSubmitEdit}
              onCancelEdit={actions.onCancelEdit}
            />
          )}
        </div>
        {actions.error && (
          <p role="alert" className="border-t border-line px-3 py-2 text-[12px] text-red-400">
            {actions.error}
          </p>
        )}
        <WidthResizer width={treeWidth} />
      </div>
      <FileEscapeContext.Provider value={closeFileRef}>{children}</FileEscapeContext.Provider>
      {/* No body: o painel da conversa, na mesma camada e depois no DOM, cobriria os dois. */}
      {createPortal(
        <Presence kind="menu">{actions.menu && <ContextMenu menu={actions.menu} onClose={actions.closeMenu} />}</Presence>,
        document.body
      )}
      {createPortal(
        <Presence kind="modal">{actions.confirm && <ConfirmDialog request={actions.confirm} onClose={actions.closeConfirm} />}</Presence>,
        document.body
      )}
    </aside>
  )
}
