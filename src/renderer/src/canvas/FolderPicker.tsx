import { memo, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Folder, FolderOpen, Search } from 'lucide-react'
import type { KnownFolder } from '../../../shared/sessions'
import { lastSep, parentDir } from '../platform'
import { Modal } from '../ui/Modal'
import { TimeAgo } from './blocks/TimeAgo'
import { displayPath } from './factory'

// "Nova pasta": as pastas onde o Claude Code já conversou, da mais recente para a mais antiga,
// para não confundir pastas de nome parecido no seletor do sistema. Pasta sem conversa
// entra por "Escolher outra pasta…".
export function FolderPicker({
  onCanvas,
  onPick,
  onClose
}: {
  // Pastas já no canvas (como displayPath): aparecem marcadas, mas dá para adicionar de novo.
  onCanvas: Set<string>
  // Caminho absoluto da pasta escolhida.
  onPick: (folder: string) => void
  onClose: () => void
}) {
  const [folders, setFolders] = useState<KnownFolder[] | null>(null)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    let alive = true
    void window.api.sessions.folders().then((all) => alive && setFolders(all))
    return () => {
      alive = false
    }
  }, [])

  const q = query.trim().toLowerCase()
  const shown = (folders ?? []).filter((f) => !q || f.path.toLowerCase().includes(q))

  useEffect(() => {
    list.current?.children[highlight]?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  const pickOther = async () => {
    const folder = await window.api.pickFolder()
    if (folder) onPick(folder)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') setHighlight((h) => Math.min(h + 1, shown.length - 1))
    else if (e.key === 'ArrowUp') setHighlight((h) => Math.max(h - 1, 0))
    else if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      if (shown[highlight]) onPick(shown[highlight].path)
    } else return
    e.preventDefault()
  }

  return (
    <Modal variant="palette" label="Nova pasta" className="flex flex-col" onClose={onClose}>
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
        <Search size={15} className="shrink-0 text-muted" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            // A lista muda com a busca: o destaque volta para o primeiro.
            setHighlight(0)
          }}
          onKeyDown={onKeyDown}
          placeholder="Buscar pasta com conversa do Claude Code"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
        />
      </div>

      {folders === null ? (
        <p className="px-3 py-4 text-xs text-muted">Lendo as conversas…</p>
      ) : shown.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted">
          {query ? 'Nenhuma pasta com esse nome.' : 'Nenhuma pasta com conversa do Claude Code.'}
        </p>
      ) : (
        <ul ref={list} className="min-h-0 flex-1 overflow-y-auto p-1">
          {shown.map((f, i) => (
            <FolderRow
              key={f.path}
              folder={f}
              index={i}
              highlighted={i === highlight}
              onCanvas={onCanvas}
              onPick={onPick}
              onHighlight={setHighlight}
            />
          ))}
        </ul>
      )}

      <button
        onClick={() => void pickOther()}
        className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2.5 text-left text-xs text-muted hover:bg-surface-2 hover:text-text"
      >
        <FolderOpen size={14} className="shrink-0" />
        Escolher outra pasta…
      </button>
    </Modal>
  )
}

// Uma pasta da lista: nome, pasta de cima, "no canvas" e há quanto tempo teve conversa.
const FolderRow = memo(function FolderRow({
  folder,
  index,
  highlighted,
  onCanvas,
  onPick,
  onHighlight
}: {
  folder: KnownFolder
  index: number
  highlighted: boolean
  onCanvas: Set<string>
  onPick: (folder: string) => void
  onHighlight: (index: number) => void
}) {
  const path = displayPath(folder.path)
  const parent = parentDir(path) || path.slice(0, lastSep(path) + 1)
  return (
    <li>
      <button
        onClick={() => onPick(folder.path)}
        onMouseMove={() => onHighlight(index)}
        title={path}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
          highlighted ? 'bg-accent [&_span]:border-white/40 [&_span]:text-white [&_svg]:text-white' : ''
        }`}
      >
        <Folder size={14} className="shrink-0 text-muted" />
        <span className="shrink-0 font-medium text-text">{path.slice(lastSep(path) + 1)}</span>
        <span className="min-w-0 truncate text-faint">{parent}</span>
        {onCanvas.has(path) && (
          <span className="shrink-0 rounded-full border border-line px-1.5 text-[11px] text-faint">no canvas</span>
        )}
        <TimeAgo iso={folder.updatedAt} className="pl-2" />
      </button>
    </li>
  )
})
