import { memo, useCallback, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { ChevronDown, Folder, Loader2, Plus, Search, X } from 'lucide-react'
import { ResizeHandles, useFloatingRect, type PanelRect } from '../conversation/FloatingPanel'
import { useNow } from '../lib/clock'
import { IconButton } from '../ui/IconButton'
import { useEscape } from '../useEscape'
import { useCanvasActions } from './CanvasContext'
import { ConversationItem } from './ConversationItem'
import { favoriteKey, useFavorites } from './favorites'
import { groupByDay } from './project/groupByDay'
import { useSessions } from './sessionsStore'
import { useConversationSearch } from './useConversationSearch'
import type { ConversationSummary } from './types'
import { useActiveConversationIn, usePoppedOutSet } from './useCanvasView'
import { tr } from '../i18n'

// Todas as conversas de uma pasta, num painel flutuante: no canvas só as mais recentes
// viram card. Nasce à esquerda, para ficar ao lado do drawer da conversa (à direita), e continua
// aberto ao abrir uma: dá para ir passando de uma para outra.
const LIST_WIDTH = 400
// Quantas conversas a lista mostra de cada vez; "Ver mais" mostra outras tantas. Pasta com
// centenas de conversas montava todas as linhas ao abrir o painel.
const PAGE = 50

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
  const all = useSessions(project.path)
  // As favoritas ficam numa seção no topo, sempre à vista; as outras seguem por dia, em levas.
  const favoriteIds = useFavorites()
  const [favorites, conversations] = useMemo(() => {
    if (!favoriteIds.size) return [[], all]
    const isFav = (c: ConversationSummary) => favoriteIds.has(favoriteKey(c) ?? '')
    return [all.filter(isFav), all.filter((c) => !isFav(c))]
  }, [all, favoriteIds])
  // Busca pelo título e pelo conteúdo: com algo digitado, a lista vira os resultados (favoritas primeiro).
  const [query, setQuery] = useState('')
  const ordered = useMemo(() => [...favorites, ...conversations], [favorites, conversations])
  const search = useConversationSearch(project.path, ordered, query)
  // Trocou de pasta: volta à primeira leva.
  const [page, setPage] = useState({ path: project.path, count: PAGE })
  const count = page.path === project.path ? page.count : PAGE
  const shown = conversations.length > count ? conversations.slice(0, count) : conversations
  // A conversa aberta no drawer, se for desta pasta, e as que estão em janela separada.
  const active = useActiveConversationIn(nodeId)
  const poppedOut = usePoppedOutSet()
  // Só para separar os dias (o "há 5min" de cada linha acompanha o relógio sozinho).
  const now = useNow(60_000)
  const panelRef = useRef<HTMLElement>(null)
  const floating = useFloatingRect(panelRef, rect, onRectChange, LIST_WIDTH, undefined, 'left')
  useEscape(onClose)
  // A mesma função para todas as linhas.
  const open = useCallback((c: ConversationSummary) => onOpen(c.id), [onOpen])
  // Botão direito: o mesmo menu da lista na pasta (abrir, mover para a Lixeira).
  const { openConversationMenu } = useCanvasActions()
  const openMenu = useCallback(
    (e: ReactMouseEvent, c: ConversationSummary) => openConversationMenu(e, nodeId, c),
    [openConversationMenu, nodeId]
  )

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
            {tr(
              `${all.length} conversa${all.length === 1 ? '' : 's'}`,
              `${all.length} chat${all.length === 1 ? '' : 's'}`
            )}
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
          {tr('Nova', 'New')}
        </button>
        <IconButton label={tr('Fechar', 'Close')} onClick={onClose}>
          <X size={16} />
        </IconButton>
      </header>

      <div className="mx-3 mt-3 flex items-center gap-2 rounded-md border border-line bg-surface px-2 focus-within:border-line-strong">
        <Search size={13} className="shrink-0 text-faint" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            // Com algo digitado, o ESC limpa a busca; vazio, fecha o painel (useEscape).
            if (e.key === 'Escape' && query) {
              e.preventDefault()
              setQuery('')
            }
          }}
          placeholder={tr('Buscar no título ou no conteúdo', 'Search titles or content')}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-text outline-none placeholder:text-faint"
        />
        {search?.searching && <Loader2 size={12} className="shrink-0 animate-spin text-faint" />}
        {query && (
          <button aria-label={tr('Limpar busca', 'Clear search')} onClick={() => setQuery('')} className="text-faint hover:text-text">
            <X size={13} />
          </button>
        )}
      </div>

      {search ? (
        <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {search.results.map(({ conversation: c, snippet }) => (
            <ConversationItem
              key={c.id}
              conversation={c}
              snippet={snippet}
              query={query}
              poppedOut={poppedOut.has(c.id)}
              active={!!active && (active.conversationId === c.id || active.sessionId === c.id)}
              onOpen={open}
              onContextMenu={openMenu}
            />
          ))}
          {!search.searching && search.results.length === 0 && (
            <li className="px-2 py-1.5 text-xs text-faint">{tr(`Nenhuma conversa com "${query.trim()}"`, `No chats with "${query.trim()}"`)}</li>
          )}
        </ul>
      ) : (
        <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {[
            ...(favorites.length ? [{ key: 'favorites', label: tr('Favoritas', 'Favorites'), items: favorites }] : []),
            // Com as favoritas em cima, as de hoje também precisam de título, senão parecem favoritas.
            ...groupByDay(shown, now).map((g) => (g.label || !favorites.length ? g : { ...g, label: tr('Hoje', 'Today') }))
          ].map((g, i) => (
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
                    onContextMenu={openMenu}
                  />
                ))}
              </ul>
            </li>
          ))}
          {conversations.length > count && (
            <li>
              <button
                onClick={() => setPage({ path: project.path, count: count + PAGE })}
                className="flex h-7 w-full items-center gap-2.5 rounded-lg px-2 text-xs text-faint hover:bg-fill hover:text-text"
              >
                <ChevronDown size={12} className="shrink-0" />
                {tr(`Ver mais (${conversations.length - count} restantes)`, `Show more (${conversations.length - count} left)`)}
              </button>
            </li>
          )}
          {all.length === 0 && <li className="px-2 py-1.5 text-xs text-faint">{tr('Nenhuma conversa ainda', 'No chats yet')}</li>}
        </ul>
      )}
    </aside>
  )
})
