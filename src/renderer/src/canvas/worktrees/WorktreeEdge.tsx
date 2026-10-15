import { memo } from 'react'
import { getBezierPath, type Edge, type EdgeProps } from '@xyflow/react'
import { useSessions } from '../sessionsStore'
import { useWorktreeStatus } from './useWorktreeStatus'

export type WorktreeEdgeData = { path: string }
export type WorktreeEdgeType = Edge<WorktreeEdgeData, 'worktree'>

const RADIUS = 10

// Linha da pasta até uma tarefa isolada: desce da base do ícone da pasta, como o tronco das
// conversas dentro do card, e entra pela esquerda da tarefa na altura do ícone dela. Tarefa
// arrastada para a esquerda da pasta: uma curva simples. Pontilhada: a tarefa é uma cópia ligada à
// pasta, não um pedaço dela (as linhas das conversas, dentro do card, são cheias). Enquanto a tarefa prepara ou tem conversa
// rodando, um tracejado anda por cima, como na linha até a conversa rodando.
function WorktreeEdgeView({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps<WorktreeEdgeType>) {
  const path =
    targetX > sourceX + RADIUS && targetY > sourceY + RADIUS
      ? `M ${sourceX} ${sourceY} V ${targetY - RADIUS} Q ${sourceX} ${targetY} ${sourceX + RADIUS} ${targetY} H ${targetX}`
      : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })[0]
  const conversations = useSessions(data?.path ?? '')
  const preparing = useWorktreeStatus(data?.path ?? '')?.state === 'preparing'
  const busy = preparing || conversations.some((c) => c.status === 'running')
  return (
    <g className="pointer-events-none">
      <path d={path} fill="none" stroke="var(--color-line-strong)" strokeWidth={1.5} strokeDasharray="4 4" />
      {busy && <path d={path} fill="none" stroke="var(--color-running)" strokeWidth={1.5} className="conversation-flow" />}
      <circle cx={targetX} cy={targetY} r={3} fill={busy ? 'var(--color-running)' : 'var(--color-line-strong)'} />
    </g>
  )
}

export const WorktreeEdge = memo(WorktreeEdgeView)

export const edgeTypes = { worktree: WorktreeEdge }
