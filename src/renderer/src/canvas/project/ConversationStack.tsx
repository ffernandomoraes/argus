import { memo, useCallback, type MouseEvent as ReactMouseEvent } from 'react'
import { List } from 'lucide-react'
import { useCanvasActions } from '../CanvasContext'
import type { RunningAgent } from '../../../../shared/agents'
import type { ConversationSummary } from '../types'
import { useActiveConversationIn, useActiveDesignIn } from '../useCanvasView'
import { AgentRow } from './AgentRow'
import { ConversationRow } from './ConversationRow'
import { TasksRow } from './TasksRow'
import { INDENT, legPath } from './geometry'
import { useProjectRows } from './useProjectRows'
import { MAX_CONVERSATIONS } from './projectRows'
import { tr } from '../../i18n'

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
  const { openConversation, openSubagent, openTasks, openConversationMenu, openAllConversations } = useCanvasActions()
  // Conversa e design abertos, só se forem desta pasta: abrir em outra pasta não redesenha esta.
  const activeConversation = useActiveConversationIn(nodeId)
  const activeDesign = useActiveDesignIn(nodeId)
  // As mesmas funções para todas as linhas: o memo delas vale enquanto as ações não mudam.
  const open = useCallback((c: ConversationSummary) => openConversation(nodeId, c.id), [openConversation, nodeId])
  // Subagente rodando: o histórico dele, só para ler. Sem a chamada que o lançou, não há como
  // achá-lo: abre a conversa.
  const openAgent = useCallback(
    (a: RunningAgent, c: ConversationSummary) => {
      const sessionId = c.sessionId ?? c.id
      if (!a.toolUseId) return openConversation(nodeId, c.id)
      openSubagent(nodeId, '', { sessionId, toolUseId: a.toolUseId, agent: a.agent, description: a.description })
    },
    [openConversation, openSubagent, nodeId]
  )
  // Tarefas em segundo plano: a saída de cada uma, só para ler.
  const openTaskList = useCallback(
    (c: ConversationSummary) => openTasks(nodeId, '', { sessionId: c.sessionId ?? c.id }),
    [openTasks, nodeId]
  )
  const openMenu = useCallback(
    (e: ReactMouseEvent, c: ConversationSummary) => openConversationMenu(e, nodeId, c),
    [openConversationMenu, nodeId]
  )
  if (rows.length === 0 && collapsed) return null
  // À direita, os mesmos 12px do ícone da pasta à esquerda (o px-3 do cabeçalho).
  // "Ver todas" só quando sobra conversa fora da pilha. Sem ele, a última conversa ganha mais
  // respiro até o fim do card (ou até a divisória das pastas do espaço de trabalho).
  const showAll = !collapsed && conversations.length > MAX_CONVERSATIONS

  const isActive = (c: ConversationSummary) =>
    (!!activeConversation && (activeConversation.conversationId === c.id || activeConversation.sessionId === c.id)) ||
    (!!c.designId && activeDesign === c.designId)

  return (
    <ul className={`relative flex flex-col gap-1 pr-3 ${showAll ? 'pb-1.5' : 'pb-3'}`} style={{ paddingLeft: INDENT }}>
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
            onOpen={openAgent}
          />
        ) : row.kind === 'tasks' ? (
          <TasksRow
            key={`tasks-${row.conversation.id}`}
            count={row.count}
            since={row.since}
            conversation={row.conversation}
            first={row.first}
            color={flowColor}
            onOpen={openTaskList}
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
      {/* Fecha a lista: abre todas no painel flutuante. Só quando sobra conversa fora da pilha. */}
      {showAll && (
        <li>
          <button
            onClick={() => openAllConversations(nodeId)}
            className="nodrag flex h-7 w-full items-center gap-2.5 rounded-lg px-2 text-xs text-faint hover:bg-fill hover:text-text"
          >
            <List size={12} className="shrink-0" />
            {tr(`Ver todas as ${conversations.length} conversas`, `View all ${conversations.length} chats`)}
          </button>
        </li>
      )}
    </ul>
  )
})
