import { memo } from 'react'
import { Elapsed } from '../../conversation/Elapsed'
import type { ConversationSummary } from '../types'
import { agentPath } from './geometry'
import { tr } from '../../i18n'

// Comandos que o Claude deixou rodando em segundo plano, numa linha só com a quantidade, pendurada
// embaixo da conversa como os subagentes, com há quanto tempo roda a mais antiga. Some quando todos
// terminam. Clicar abre a conversa.
export const TasksRow = memo(function TasksRow({
  count,
  since,
  conversation,
  first,
  color,
  onOpen
}: {
  count: number
  // Início da tarefa mais antiga (ms).
  since?: number
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
        {count === 1
          ? tr('1 tarefa em segundo plano', '1 background task')
          : tr(`${count} tarefas em segundo plano`, `${count} background tasks`)}
      </span>
      {since !== undefined && (
        <span className="ml-auto shrink-0 pl-2 text-[11px] tabular-nums text-faint">
          <Elapsed since={since} />
        </span>
      )}
    </li>
  )
})
