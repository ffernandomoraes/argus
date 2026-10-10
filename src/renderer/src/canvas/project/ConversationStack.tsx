import { memo, useCallback, type MouseEvent as ReactMouseEvent } from 'react'
import { List } from 'lucide-react'
import { useCanvasActions } from '../CanvasContext'
import type { ConversationSummary } from '../types'
import { useActiveConversationIn, useActiveDesignIn } from '../useCanvasView'
import { AgentRow } from './AgentRow'
import { ConversationRow } from './ConversationRow'
import { TasksRow } from './TasksRow'
import { INDENT, legPath } from './geometry'
import { useProjectRows } from './useProjectRows'

// Lista de conversas dentro da caixa da pasta: as mais recentes (recolhida, só as que pedem
// atenção), cada uma com os subagentes rodando e a perninha que sai do ícone da pasta, e o botão
// que abre todas no painel flutuante. Recolhida e sem nada pedindo atenção, não aparece.
export const ConversationStack = memo(function ConversationStack({
  nodeId,
  conversations,
  collapsed,
  flowColor
}: {
  nodeId: string
  conversations: ConversationSummary[]
  collapsed: boolean
  // Cor da linha até a conversa rodando e dos subagentes (a do grupo, ou a de "rodando").
  flowColor: string
}) {
  const { rows, legs } = useProjectRows(conversations, collapsed)
  const { openConversation, openConversationMenu, openAllConversations } = useCanvasActions()
  // Conversa e design abertos, só se forem desta pasta: abrir em outra pasta não redesenha esta.
  const activeConversation = useActiveConversationIn(nodeId)
  const activeDesign = useActiveDesignIn(nodeId)
  // As mesmas funções para todas as linhas: o memo delas vale enquanto as ações não mudam.
  const open = useCallback((c: ConversationSummary) => openConversation(nodeId, c.id), [openConversation, nodeId])
  const openMenu = useCallback(
    (e: ReactMouseEvent, c: ConversationSummary) => openConversationMenu(e, nodeId, c),
    [openConversationMenu, nodeId]
  )
  if (rows.length === 0 && collapsed) return null

  const isActive = (c: ConversationSummary) =>
    (!!activeConversation && (activeConversation.conversationId === c.id || activeConversation.sessionId === c.id)) ||
    (!!c.designId && activeDesign === c.designId)

  return (
    <ul className="relative flex flex-col gap-1 pb-1.5 pr-1.5" style={{ paddingLeft: INDENT }}>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-full overflow-visible"
        style={{ width: INDENT }}
      >
        {legs.map((l, i) => (
          <path key={i} d={legPath(l.middle)} fill="none" stroke="var(--color-line-strong)" strokeWidth={1.5} />
        ))}
        {/* Por cima das outras: o caminho até a conversa rodando, tracejado andando. */}
        {legs.map((l, i) =>
          l.running ? (
            <path
              key={`running-${i}`}
              d={legPath(l.middle)}
              fill="none"
              stroke={flowColor}
              strokeWidth={1.5}
              className="conversation-flow"
            />
          ) : null
        )}
      </svg>
      {rows.map((row) =>
        row.kind === 'agent' ? (
          <AgentRow
            key={`agent-${row.agent.id}`}
            agent={row.agent}
            conversation={row.conversation}
            first={row.first}
            color={flowColor}
            onOpen={open}
          />
        ) : row.kind === 'tasks' ? (
          <TasksRow
            key={`tasks-${row.conversation.id}`}
            count={row.count}
            conversation={row.conversation}
            first={row.first}
            color={flowColor}
            onOpen={open}
          />
        ) : (
          <ConversationRow
            key={row.conversation.id}
            conversation={row.conversation}
            active={isActive(row.conversation)}
            onOpen={open}
            onContextMenu={openMenu}
          />
        )
      )}
      {/* Fecha a lista: abre todas no painel flutuante. */}
      {!collapsed && (
        <li>
          <button
            onClick={() => openAllConversations(nodeId)}
            className="nodrag flex h-7 w-full items-center gap-2.5 rounded-lg px-2 text-xs text-faint hover:bg-fill hover:text-text"
          >
            <List size={12} className="shrink-0" />
            Ver todas as {conversations.length} conversas
          </button>
        </li>
      )}
    </ul>
  )
})
