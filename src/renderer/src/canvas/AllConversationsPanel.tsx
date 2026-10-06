import { Folder, Loader2, Plus, Search, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { ResizeHandles, useFloatingRect, type PanelRect } from '../conversation/FloatingPanel'
import { ConversationItem, useNow } from './ConversationItem'
import { useConversationSearch } from './useConversationSearch'
import { useSessions } from './sessionsStore'
import type { ActiveConversation } from './CanvasContext'

// Todas as conversas de uma pasta, num painel flutuante: o card do canvas mostra só as
// cinco mais recentes.
export function AllConversationsPanel({
  project,
  nodeId,
  active,
  poppedOut,
  rect,
  onRectChange,
  onOpen,
  onNew,
  onClose
}: {
  project: { name: string; path: string }
  nodeId: string
  active: ActiveConversation | null
  poppedOut: Set<string>
  rect: PanelRect | null
  onRectChange: (rect: PanelRect) => void
  onOpen: (conversationId: string) => void
  onNew: () => void
  onClose: () => void
}) {
  const conversations = useSessions(project.path)
  const [query, setQuery] = useState('')
  const search = useConversationSearch(project.path, conversations, query)
  const shown = search
    ? search.results
    : [...conversations]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((conversation) => ({ conversation, snippet: undefined as string | undefined }))
  const now = useNow()
  const panelRef = useRef<HTMLElement>(null)
  const floating = useFloatingRect(panelRef, rect, onRectChange)

  return (
    <aside
      ref={panelRef}
      className="absolute z-40 flex flex-col overflow-hidden rounded-xl border border-line bg-bg shadow-2xl shadow-black/50"
      style={rect ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height } : { visibility: 'hidden', inset: 0 }}
    >
      <ResizeHandles onResizeStart={floating.onResizeStart} />
      <header
        onPointerDown={floating.onMoveStart}
        className="flex items-center gap-3 border-b border-line px-4 py-3 cursor-grab active:cursor-grabbing"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {conversations.length} conversa{conversations.length === 1 ? '' : 's'}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-faint">
            <Folder size={12} className="shrink-0" />
            <span className="truncate">{project.name}</span>
          </div>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 rounded-md border border-line-strong bg-surface-2 px-2 py-1.5 text-xs font-medium text-text hover:bg-line"
        >
          <Plus size={13} />
          Nova
        </button>
        <button aria-label="Fechar" onClick={onClose} className="text-faint hover:text-text">
          <X size={16} />
        </button>
      </header>

      <div className="mx-3 mt-3 flex items-center gap-2 rounded-md border border-line bg-surface px-2 focus-within:border-line-strong">
        <Search size={13} className="shrink-0 text-faint" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && (query ? setQuery('') : onClose())}
          placeholder="Buscar conversa"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-text outline-none placeholder:text-faint"
        />
        {search?.searching && <Loader2 size={12} className="shrink-0 animate-spin text-faint" />}
        {query && (
          <button aria-label="Limpar busca" onClick={() => setQuery('')} className="text-faint hover:text-text">
            <X size={13} />
          </button>
        )}
      </div>

      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {shown.map(({ conversation: c, snippet }) => (
          <ConversationItem
            key={c.id}
            conversation={c}
            snippet={snippet}
            now={now}
            poppedOut={poppedOut.has(c.id)}
            active={
              active?.nodeId === nodeId && (active.conversationId === c.id || active.sessionId === c.id)
            }
            onOpen={() => onOpen(c.id)}
          />
        ))}
        {conversations.length === 0 && <li className="px-2 py-1.5 text-xs text-faint">Nenhuma conversa ainda</li>}
        {search && !search.searching && search.results.length === 0 && (
          <li className="px-2 py-1.5 text-xs text-faint">Nenhuma conversa com “{query.trim()}”</li>
        )}
      </ul>
    </aside>
  )
}
