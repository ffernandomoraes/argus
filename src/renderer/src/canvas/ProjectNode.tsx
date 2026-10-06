import type { NodeProps } from '@xyflow/react'
import { Folder } from 'lucide-react'
import { useState } from 'react'
import { useCanvasActions } from './CanvasContext'
import { EditableName } from './EditableName'
import { ChevronDown, Loader2, Plus, Search, X } from 'lucide-react'
import { INSTANCE_WIDTH } from './factory'
import { PathLabel } from './PathLabel'
import { ConversationItem, useNow } from './ConversationItem'
import { useSessions } from './sessionsStore'
import { useConversationSearch } from './useConversationSearch'
import type { ProjectNode as ProjectNodeType } from './types'

// Largura fixa e altura automática: a caixa cresce com as conversas, até MAX_CONVERSATIONS.
// Passando disso, o botão do rodapé abre todas no painel flutuante.
const MAX_CONVERSATIONS = 5

export function ProjectNode({ id, data, selected }: NodeProps<ProjectNodeType>) {
  const conversations = useSessions(data.path)
  const [query, setQuery] = useState('')
  const search = useConversationSearch(data.path, conversations, query)
  // Sem busca: as mais recentes. Com busca: todos os achados, com rolagem.
  const shown = search
    ? search.results
    : [...conversations]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, MAX_CONVERSATIONS)
        .map((conversation) => ({ conversation, snippet: undefined as string | undefined }))
  const hidden = search ? 0 : conversations.length - shown.length
  const now = useNow()
  const { activeConversation, openConversation, newConversation, openAllConversations, poppedOut } =
    useCanvasActions()

  return (
    <>
      <div
        className="flex flex-col overflow-hidden rounded-[10px] border bg-surface shadow-lg shadow-black/30"
        style={{ width: INSTANCE_WIDTH, borderColor: selected ? 'var(--color-muted)' : 'var(--color-line)' }}
      >
        <header className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
          <Folder size={14} className="shrink-0 text-muted" />
          <EditableName id={id} value={data.name} className="shrink-0 text-sm font-medium" />
          <PathLabel path={data.path} className="ml-auto pl-2 text-[11px] text-faint" />
        </header>

        <button
          onClick={() => newConversation(id)}
          className="nodrag mx-2 mt-2 flex items-center justify-center gap-1.5 rounded-md border border-line-strong bg-surface-2 py-1.5 text-xs font-medium text-text hover:bg-line">
          <Plus size={13} />
          Nova conversa
        </button>

        {conversations.length > 0 && (
          <div className="nodrag mx-2 mt-2 flex items-center gap-2 rounded-md border border-line bg-bg px-2 focus-within:border-line-strong">
            <Search size={13} className="shrink-0 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
              placeholder={`Buscar em ${conversations.length} conversa${conversations.length === 1 ? '' : 's'}`}
              className="min-w-0 flex-1 bg-transparent py-1.5 text-xs text-text outline-none placeholder:text-faint"
            />
            {search?.searching && <Loader2 size={12} className="shrink-0 animate-spin text-faint" />}
            {query && (
              <button aria-label="Limpar busca" onClick={() => setQuery('')} className="text-faint hover:text-text">
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* nowheel: rolar a lista de achados não move o canvas */}
        <ul className={`flex flex-col gap-1 p-2 ${search ? 'nowheel max-h-[420px] overflow-y-auto' : ''}`}>
          {shown.map(({ conversation: c, snippet }) => (
            <ConversationItem
              key={c.id}
              conversation={c}
              snippet={snippet}
              now={now}
              poppedOut={poppedOut.has(c.id)}
              active={
                activeConversation?.nodeId === id &&
                (activeConversation.conversationId === c.id || activeConversation.sessionId === c.id)
              }
              onOpen={() => openConversation(id, c.id)}
            />
          ))}
          {conversations.length === 0 && (
            <li className="px-2 py-1.5 text-xs text-faint">Nenhuma conversa ainda</li>
          )}
          {search && !search.searching && search.results.length === 0 && (
            <li className="px-2 py-1.5 text-xs text-faint">Nenhuma conversa com “{query.trim()}”</li>
          )}
        </ul>

        {hidden > 0 && (
          <button
            onClick={() => openAllConversations(id)}
            className="nodrag mx-2 mb-2 flex items-center justify-center gap-1.5 rounded-md border border-line bg-surface-2 py-1.5 text-[11px] font-medium text-muted hover:bg-line hover:text-text"
          >
            <ChevronDown size={12} />
            Ver todas as {conversations.length} conversas
          </button>
        )}
      </div>
    </>
  )
}
