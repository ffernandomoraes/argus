import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Folder, FolderOpen, Search } from 'lucide-react'
import type { KnownFolder } from '../../../shared/sessions'
import { useEscape } from '../useEscape'
import { lastSep, parentDir } from '../platform'
import { displayPath } from './factory'
import { relativeTime } from './relativeTime'

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
  const now = useMemo(() => Date.now(), [])

  useEffect(() => {
    void window.api.sessions.folders().then(setFolders)
  }, [])

  useEscape(onClose)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (folders ?? []).filter((f) => !q || f.path.toLowerCase().includes(q))
  }, [folders, query])

  // A lista muda com a busca: o destaque volta para o primeiro.
  useEffect(() => setHighlight(0), [query])

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
    <div className="fixed inset-0 z-50 bg-black/50" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label="Nova pasta"
        onMouseDown={(e) => e.stopPropagation()}
        className="absolute left-1/2 top-[18%] flex max-h-[60vh] w-[520px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/60"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5">
          <Search size={15} className="shrink-0 text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
            {shown.map((f, i) => {
              const path = displayPath(f.path)
              const parent = parentDir(path) || path.slice(0, lastSep(path) + 1)
              return (
                <li key={f.path}>
                  <button
                    onClick={() => onPick(f.path)}
                    onMouseMove={() => setHighlight(i)}
                    title={path}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs ${
                      i === highlight ? 'bg-surface-2' : ''
                    }`}
                  >
                    <Folder size={14} className="shrink-0 text-muted" />
                    <span className="shrink-0 font-medium text-text">{path.slice(lastSep(path) + 1)}</span>
                    <span className="min-w-0 truncate text-faint">{parent}</span>
                    {onCanvas.has(path) && (
                      <span className="shrink-0 rounded border border-line px-1 text-[10px] text-faint">no canvas</span>
                    )}
                    <span
                      title={new Date(f.updatedAt).toLocaleString('pt-BR')}
                      className="ml-auto shrink-0 pl-2 text-[10px] text-faint"
                    >
                      {relativeTime(f.updatedAt, now)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}

        <button
          onClick={() => void pickOther()}
          className="flex shrink-0 items-center gap-2 border-t border-line px-3 py-2.5 text-left text-xs text-muted hover:bg-surface-2 hover:text-text"
        >
          <FolderOpen size={14} className="shrink-0" />
          Escolher outra pasta…
        </button>
      </div>
    </div>
  )
}
