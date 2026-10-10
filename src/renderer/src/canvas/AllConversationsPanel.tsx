import { memo, useCallback, useRef } from 'react'
import { Folder, Plus, X } from 'lucide-react'
import { ResizeHandles, useFloatingRect, type PanelRect } from '../conversation/FloatingPanel'
import { useNow } from '../lib/clock'
import { IconButton } from '../ui/IconButton'
import { useEscape } from '../useEscape'
import { ConversationItem } from './ConversationItem'
import { groupByDay } from './project/groupByDay'
import { useSessions } from './sessionsStore'
import type { ConversationSummary } from './types'
import { useActiveConversationIn, usePoppedOutSet } from './useCanvasView'

// Todas as conversas de uma pasta, num painel flutuante: no canvas só as mais recentes
// viram card.
export const AllConversationsPanel = memo(function AllConversationsPanel({
  project,
  nodeId,
  rect,
  onRectChange,
  onOpen,
  onNew,
  onClose
}: {
  project: { name: string; path: string }
  nodeId: string
  rect: PanelRect | null
  onRectChange: (rect: PanelRect) => void
  onOpen: (conversationId: string) => void
  onNew: () => void
  onClose: () => void
}) {
  // Já vem da mais recente para a mais antiga (sessionsStore).
  const conversations = useSessions(project.path)
  // A conversa aberta no drawer, se for desta pasta, e as que estão em janela separada.
  const active = useActiveConversationIn(nodeId)
  const poppedOut = usePoppedOutSet()
  // Só para separar os dias (o "há 5min" de cada linha acompanha o relógio sozinho).
  const now = useNow(60_000)
  const panelRef = useRef<HTMLElement>(null)
  const floating = useFloatingRect(panelRef, rect, onRectChange)
  useEscape(onClose)
  // A mesma função para todas as linhas.
  const open = useCallback((c: ConversationSummary) => onOpen(c.id), [onOpen])

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
        <IconButton label="Fechar" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>

      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {groupByDay(conversations, now).map((g, i) => (
          <li key={g.key} className="flex flex-col gap-1">
            {g.label && (
              <div className={`px-2 pb-0.5 text-[11px] font-medium text-faint ${i > 0 ? 'pt-3' : ''}`}>{g.label}</div>
            )}
            <ul className="flex flex-col gap-1">
              {g.items.map((c) => (
                <ConversationItem
                  key={c.id}
                  conversation={c}
                  poppedOut={poppedOut.has(c.id)}
                  active={!!active && (active.conversationId === c.id || active.sessionId === c.id)}
                  onOpen={open}
                />
              ))}
            </ul>
          </li>
        ))}
        {conversations.length === 0 && <li className="px-2 py-1.5 text-xs text-faint">Nenhuma conversa ainda</li>}
      </ul>
    </aside>
  )
})
