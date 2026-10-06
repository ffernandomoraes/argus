import { useEffect, useState } from 'react'
import { ChevronRight, File, Folder, FolderOpen, X } from 'lucide-react'
import type { FileEntry } from '../../../shared/files'

function TreeItem({
  root,
  entry,
  depth,
  selected,
  onOpenFile
}: {
  root: string
  entry: FileEntry
  depth: number
  selected: string | null
  onOpenFile: (path: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState<FileEntry[] | null>(null)

  const toggle = () => {
    if (!entry.isDir) return onOpenFile(entry.path)
    if (!children) window.api.files.list(root, entry.path).then(setChildren)
    setOpen((o) => !o)
  }

  const Icon = entry.isDir ? (open ? FolderOpen : Folder) : File

  return (
    <li>
      <button
        onClick={toggle}
        style={{ paddingLeft: 8 + depth * 12 }}
        className={`flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-xs ${
          selected === entry.path ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text'
        }`}
      >
        <ChevronRight
          size={12}
          className={`shrink-0 transition-transform ${entry.isDir ? '' : 'invisible'} ${open ? 'rotate-90' : ''}`}
        />
        <Icon size={13} className="shrink-0 text-faint" />
        <span className="truncate">{entry.name}</span>
      </button>
      {open && children && (
        <ul>
          {children.map((c) => (
            <TreeItem key={c.path} root={root} entry={c} depth={depth + 1} selected={selected} onOpenFile={onOpenFile} />
          ))}
          {children.length === 0 && (
            <li style={{ paddingLeft: 32 + depth * 12 }} className="py-1 text-[11px] text-faint">
              vazia
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

// Painel da esquerda: árvore de pastas e arquivos do projeto, carregada sob demanda.
export function CodeExplorer({
  root,
  name,
  selected,
  onOpenFile,
  onClose
}: {
  root: string
  name: string
  selected: string | null
  onOpenFile: (path: string) => void
  onClose: () => void
}) {
  const [entries, setEntries] = useState<FileEntry[] | null>(null)

  useEffect(() => {
    setEntries(null)
    window.api.files.list(root, '').then(setEntries)
  }, [root])

  return (
    <aside className="absolute bottom-4 left-4 top-4 z-40 flex w-[280px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/50">
      <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <Folder size={14} className="shrink-0 text-muted" />
        <span className="flex-1 truncate text-sm font-medium">{name}</span>
        <button
          aria-label="Fechar código"
          title="Fechar código"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
        >
          <X size={15} />
        </button>
      </header>
      <ul className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {entries === null && <li className="px-2 py-1 text-xs text-faint">Carregando…</li>}
        {entries?.length === 0 && <li className="px-2 py-1 text-xs text-faint">Pasta vazia ou inexistente</li>}
        {entries?.map((e) => (
          <TreeItem key={e.path} root={root} entry={e} depth={0} selected={selected} onOpenFile={onOpenFile} />
        ))}
      </ul>
    </aside>
  )
}
