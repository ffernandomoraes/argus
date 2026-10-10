import { memo } from 'react'
import { Elapsed } from '../../conversation/turnInfo'
import { agentActivity } from '../runningAgents'
import type { RunningAgent } from '../../../../shared/agents'
import type { ConversationSummary } from '../types'
import { agentPath } from './geometry'

// Subagente rodando, pendurado embaixo da conversa que o lançou: qual agente, o que está
// fazendo agora e há quanto tempo. Some quando ele termina. Clicar abre a conversa dele.
export const AgentRow = memo(function AgentRow({
  agent: a,
  conversation,
  first,
  color,
  onOpen
}: {
  agent: RunningAgent
  conversation: ConversationSummary
  // Primeiro subagente da conversa: a linha sai do ícone dela.
  first: boolean
  color: string
  onOpen: (conversation: ConversationSummary) => void
}) {
  return (
    <li
      role="button"
      onClick={() => onOpen(conversation)}
      title={a.description}
      className="nodrag relative flex h-6 cursor-pointer items-center gap-2 rounded-lg pl-[30px] pr-2.5 text-xs hover:bg-fill"
    >
      <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-full w-[30px] overflow-visible">
        <path d={agentPath(first)} fill="none" stroke={color} strokeWidth={1.5} className="conversation-flow" />
      </svg>
      <span className="size-1.5 shrink-0 rounded-full bg-running/80" aria-hidden="true" />
      <span className="min-w-0 truncate text-muted">
        {a.agent} - {agentActivity(a)}
      </span>
      <span className="ml-auto shrink-0 pl-2 text-[11px] tabular-nums text-faint">
        <Elapsed since={a.startedAt} />
      </span>
    </li>
  )
})
