import { memo } from 'react'
import type { ConversationSummary } from '../types'
import { agentPath } from './geometry'

// Comandos que o Claude deixou rodando em segundo plano, numa linha só com a quantidade, pendurada
// embaixo da conversa como os subagentes. Some quando todos terminam. Clicar abre a conversa.
export const TasksRow = memo(function TasksRow({
  count,
  conversation,
  first,
  color,
  onOpen
}: {
  count: number
  conversation: ConversationSummary
  // Sem subagente antes: a linha sai do ícone da conversa.
  first: boolean
  color: string
  onOpen: (conversation: ConversationSummary) => void
}) {
  return (
    <li
      role="button"
      onClick={() => onOpen(conversation)}
      className="nodrag relative flex h-6 cursor-pointer items-center gap-2 rounded-lg pl-[30px] pr-2.5 text-xs hover:bg-fill"
    >
      <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-full w-[30px] overflow-visible">
        <path d={agentPath(first)} fill="none" stroke={color} strokeWidth={1.5} className="conversation-flow" />
      </svg>
      <span className="size-1.5 shrink-0 rounded-full bg-running/80" aria-hidden="true" />
      <span className="min-w-0 truncate text-muted">
        {count === 1 ? '1 tarefa em segundo plano' : `${count} tarefas em segundo plano`}
      </span>
    </li>
  )
})
