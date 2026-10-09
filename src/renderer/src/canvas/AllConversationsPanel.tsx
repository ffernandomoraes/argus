import { Folder, Plus, X } from 'lucide-react'
import { useRef } from 'react'
import { ResizeHandles, useFloatingRect, type PanelRect } from '../conversation/FloatingPanel'
import { ConversationItem, useNow } from './ConversationItem'
import { useSessions } from './sessionsStore'
import type { ActiveConversation } from './CanvasContext'
import { useEscape } from '../useEscape'
import type { ConversationSummary } from './types'

// Agrupa por dia (local). As de hoje ficam no topo sem título; as mais antigas ganham a
// data ("19/10", ou "19/10/2025" se for de outro ano).
function groupByDay(conversations: ConversationSummary[], now: number) {
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  const today = new Date(now)
  const groups: { key: string; label: string | null; items: ConversationSummary[] }[] = []
  for (const c of conversations) {
    const d = new Date(c.updatedAt)
    const key = dayKey(d)
    let group = groups[groups.length - 1]
    if (group?.key !== key) {
      const label =
        key === dayKey(today)
          ? null
          : d.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              ...(d.getFullYear() !== today.getFullYear() && { year: 'numeric' })
            })
      group = { key, label, items: [] }
      groups.push(group)
    }
    group.items.push(c)
  }
  return groups
}

// Todas as conversas de uma pasta, num painel flutuante: no canvas só as mais recentes
// viram card.
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
  const shown = [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const now = useNow()
  const panelRef = useRef<HTMLElement>(null)
  const floating = useFloatingRect(panelRef, rect, onRectChange)
  useEscape(onClose)

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
          <div className="mt-1 flex items-center gap-2 text-[12px] text-faint">
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

      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {groupByDay(shown, now).map((g, i) => (
          <li key={g.key} className="flex flex-col gap-1">
            {g.label && (
              <div className={`px-2 pb-0.5 text-[11px] font-medium text-faint ${i > 0 ? 'pt-3' : ''}`}>{g.label}</div>
            )}
            <ul className="flex flex-col gap-1">
              {g.items.map((c) => (
                <ConversationItem
                  key={c.id}
                  conversation={c}
                  now={now}
                  poppedOut={poppedOut.has(c.id)}
                  active={
                    active?.nodeId === nodeId && (active.conversationId === c.id || active.sessionId === c.id)
                  }
                  onOpen={() => onOpen(c.id)}
                />
              ))}
            </ul>
          </li>
        ))}
        {conversations.length === 0 && <li className="px-2 py-1.5 text-xs text-faint">Nenhuma conversa ainda</li>}
      </ul>
    </aside>
  )
}
