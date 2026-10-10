import { memo, useState, type MouseEvent, type ReactNode } from 'react'
import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react'
import type { FileEntry } from '../../../../shared/files'
import { KIND_COLOR, KIND_LABEL } from '../../conversation/ConversationView'
import { NameInput } from './NameInput'
import type { Kind } from './treePaths'
import { indent } from './treeStyle'

// Itens desenhados por pasta antes do "mostrar mais": uma pasta com dezenas de milhares de arquivos
// (node_modules aberta, uma pasta de imagens) travava o painel.
const PAGE = 2000

// Criação ou renomeação em andamento: um campo de nome no lugar da linha.
export type Editing = { kind: 'create'; dir: string; isDir: boolean } | { kind: 'rename'; path: string }

export type TreeProps = {
  listings: Readonly<Record<string, FileEntry[]>>
  expanded: ReadonlySet<string>
  focused: string | null
  drafts: ReadonlySet<string>
  // Não comitado: o nome ganha a cor do VS Code (amarelo alterado, verde novo) e a letra à direita.
  changes: ReadonlyMap<string, Kind>
  editing: Editing | null
  // Os de baixo vão para cada item: precisam ser funções fixas (o item é memo).
  onClick: (entry: FileEntry) => void
  onContextMenu: (e: MouseEvent, entry: FileEntry) => void
  onSubmitEdit: (name: string) => void
  onCancelEdit: () => void
}

type ItemProps = Pick<TreeProps, 'onClick' | 'onContextMenu' | 'onSubmitEdit' | 'onCancelEdit'> & {
  entry: FileEntry
  depth: number
  open: boolean
  focused: boolean
  draft: boolean
  change?: Kind
  renaming: boolean
  // A lista de dentro da pasta aberta.
  children?: ReactNode
}

// Uma linha da árvore. Memo: digitar, focar outro item ou abrir outra pasta só redesenha as linhas
// que mudaram (a pasta aberta redesenha junto com o conteúdo dela).
const TreeItem = memo(function TreeItem({ entry, depth, open, focused, draft, change, renaming, children, ...p }: ItemProps) {
  const Icon = entry.isDir ? (open ? FolderOpen : Folder) : File

  if (renaming) {
    return (
      <li>
        <NameInput depth={depth} isDir={entry.isDir} initial={entry.name} onSubmit={p.onSubmitEdit} onCancel={p.onCancelEdit} />
      </li>
    )
  }

  return (
    <li>
      <button
        onClick={() => p.onClick(entry)}
        onContextMenu={(e) => p.onContextMenu(e, entry)}
        data-path={entry.path}
        style={{ paddingLeft: indent(depth) }}
        className={`flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-xs outline-none ${
          focused ? 'bg-selection text-white [&_span]:text-white [&_svg]:text-white' : 'text-muted hover:bg-fill hover:text-text'
        } ${entry.ignored ? 'opacity-50' : ''}`}
      >
        <ChevronRight size={12} className={`shrink-0 transition-transform ${entry.isDir ? '' : 'invisible'} ${open ? 'rotate-90' : ''}`} />
        <Icon size={13} className="shrink-0 text-faint" />
        <span className={`truncate ${change ? KIND_COLOR[change] : ''}`}>{entry.name}</span>
        <span className="ml-auto" />
        {draft && <span title="Alterações não salvas" className="size-1.5 shrink-0 rounded-full bg-text" />}
        {change &&
          (entry.isDir ? (
            <span title="Tem mudanças não comitadas" className={`size-1.5 shrink-0 rounded-full bg-current ${KIND_COLOR[change]}`} />
          ) : (
            <span title={KIND_LABEL[change]} className={`shrink-0 font-mono text-[12px] font-semibold ${KIND_COLOR[change]}`}>
              {change}
            </span>
          ))}
      </button>
      {children}
    </li>
  )
})

// Conteúdo de uma pasta da árvore (a raiz é dir '').
export function TreeList({ dir, entries, depth, ...p }: TreeProps & { dir: string; entries?: FileEntry[]; depth: number }) {
  const [limit, setLimit] = useState(PAGE)
  const creating = p.editing?.kind === 'create' && p.editing.dir === dir ? p.editing : null
  const shown = entries && entries.length > limit ? entries.slice(0, limit) : entries
  const hidden = entries ? entries.length - limit : 0
  return (
    <ul>
      {creating && (
        <li>
          <NameInput depth={depth} isDir={creating.isDir} initial="" onSubmit={p.onSubmitEdit} onCancel={p.onCancelEdit} />
        </li>
      )}
      {shown?.map((e) => {
        const open = e.isDir && p.expanded.has(e.path)
        return (
          <TreeItem
            key={e.path}
            entry={e}
            depth={depth}
            open={open}
            focused={p.focused === e.path}
            draft={p.drafts.has(e.path)}
            change={p.changes.get(e.path)}
            renaming={p.editing?.kind === 'rename' && p.editing.path === e.path}
            onClick={p.onClick}
            onContextMenu={p.onContextMenu}
            onSubmitEdit={p.onSubmitEdit}
            onCancelEdit={p.onCancelEdit}
          >
            {open && <TreeList dir={e.path} entries={p.listings[e.path]} depth={depth + 1} {...p} />}
          </TreeItem>
        )
      })}
      {hidden > 0 && (
        <li>
          <button
            onClick={() => setLimit((l) => l + PAGE)}
            style={{ paddingLeft: indent(depth) + 24 }}
            className="w-full rounded-md py-1 pr-2 text-left text-[12px] text-muted hover:bg-fill hover:text-text"
          >
            Mostrar mais - faltam {hidden.toLocaleString('pt-BR')}
          </button>
        </li>
      )}
      {entries?.length === 0 && !creating && (
        <li style={{ paddingLeft: indent(depth) + 24 }} className="py-1 text-[12px] text-faint">
          vazia
        </li>
      )}
    </ul>
  )
}
