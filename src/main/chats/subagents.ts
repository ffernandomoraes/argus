import type {
  SDKTaskNotificationMessage,
  SDKTaskProgressMessage,
  SDKTaskStartedMessage,
  SDKTaskUpdatedMessage
} from '@anthropic-ai/claude-agent-sdk'
import type { RunningAgent } from '../../shared/agents'
import { describeTool } from '../toolLabels'

// Avisos de tarefa do Claude Code. Qualquer um deles pode vir marcado como ambiente ou fora do
// histórico, mesmo onde os tipos do SDK não dizem.
export type TaskMessage = (
  | SDKTaskStartedMessage
  | SDKTaskProgressMessage
  | SDKTaskUpdatedMessage
  | SDKTaskNotificationMessage
) & { ambient?: boolean; skip_transcript?: boolean }

// Últimas ferramentas de cada subagente guardadas para mostrar no chat.
const AGENT_STEPS_MAX = 40

// Lista nova de subagentes e se ela vai para a tela na hora (alguém entrou ou saiu) ou pode
// esperar a próxima leva (só progresso). null: nada mudou.
export type AgentsChange = { agents: RunningAgent[]; urgent: boolean } | null

type Match = (a: RunningAgent) => boolean

function patchAgents(agents: RunningAgent[], match: Match, patch: (a: RunningAgent) => Partial<RunningAgent>): AgentsChange {
  if (!agents.some(match)) return null
  return { agents: agents.map((a) => (match(a) ? { ...a, ...patch(a) } : a)), urgent: false }
}

function dropAgents(agents: RunningAgent[], match: Match): AgentsChange {
  if (!agents.some(match)) return null
  return { agents: agents.filter((a) => !match(a)), urgent: true }
}

// Avisos de tarefa do Claude Code: subagente começou, avançou, terminou.
export function taskChange(agents: RunningAgent[], m: TaskMessage, now: number): AgentsChange {
  if (m.ambient || m.skip_transcript) return null
  const same: Match = (a) => a.id === m.task_id
  if (m.subtype === 'task_started') {
    if (m.task_type !== 'local_agent' && !m.subagent_type) return null
    if (agents.some(same)) return null
    const agent: RunningAgent = {
      id: m.task_id,
      toolUseId: m.tool_use_id,
      agent: m.subagent_type || 'general-purpose',
      description: m.description ?? '',
      startedAt: now,
      toolUses: 0,
      steps: [],
      background: !!m.is_backgrounded
    }
    return { agents: [...agents, agent], urgent: true }
  }
  if (m.subtype === 'task_progress') {
    return patchAgents(agents, same, (a) => ({ toolUses: m.usage?.tool_uses ?? a.toolUses, summary: m.summary || a.summary }))
  }
  if (m.subtype === 'task_updated') {
    const status = m.patch?.status
    if (status && status !== 'running' && status !== 'pending' && status !== 'paused') return dropAgents(agents, same)
    if (m.patch?.is_backgrounded !== undefined) return patchAgents(agents, same, () => ({ background: !!m.patch.is_backgrounded }))
    return null
  }
  if (m.subtype === 'task_notification') return dropAgents(agents, same)
  return null
}

// Ferramenta usada por dentro de um subagente: entra na lista dele.
export function subagentSteps(agents: RunningAgent[], parent: string, content: unknown): AgentsChange {
  if (!Array.isArray(content)) return null
  const uses = content.filter((c) => c?.type === 'tool_use').map((c) => describeTool(c.name, c.input))
  if (!uses.length) return null
  return patchAgents(
    agents,
    (a) => a.toolUseId === parent,
    (a) => ({ steps: [...a.steps, ...uses.map((d) => ({ label: d.label, summary: d.summary }))].slice(-AGENT_STEPS_MAX) })
  )
}

// Resultado da chamada que lançou o subagente: em primeiro plano, ele terminou.
export function finishedAgents(agents: RunningAgent[], done: Set<string>): AgentsChange {
  return dropAgents(agents, (a) => !a.background && !!a.toolUseId && done.has(a.toolUseId))
}
