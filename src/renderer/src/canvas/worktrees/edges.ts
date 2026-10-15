import type { CanvasNode } from '../types'
import type { WorktreeEdgeType } from './WorktreeEdge'

// Ids das alças invisíveis do card da pasta (ProjectNode) de onde a linha sai e onde ela entra.
export const WORKTREE_OUT = 'worktree-out'
export const WORKTREE_IN = 'worktree-in'

// Muda só quando uma tarefa isolada entra, sai ou troca de pasta.
function keyOf(nodes: CanvasNode[]): string {
  const ids = new Set(nodes.map((n) => n.id))
  return nodes
    .flatMap((n) => (n.type === 'project' && n.data.worktree && ids.has(n.data.worktree.of) ? [`${n.id}>${n.data.worktree.of}>${n.data.path}`] : []))
    .join('|')
}

let last: { key: string; edges: WorktreeEdgeType[] } = { key: '', edges: [] }

// Uma linha por tarefa isolada, da pasta dela até ela. Calculadas dos nós, nunca salvas. A mesma
// lista enquanto a chave não muda: um arraste não refaz as linhas a cada quadro.
export function worktreeEdges(nodes: CanvasNode[]): WorktreeEdgeType[] {
  const key = keyOf(nodes)
  if (key === last.key) return last.edges
  last = { key, edges: buildEdges(nodes) }
  return last.edges
}

function buildEdges(nodes: CanvasNode[]): WorktreeEdgeType[] {
  const ids = new Set(nodes.map((n) => n.id))
  return nodes.flatMap((n) =>
    n.type === 'project' && n.data.worktree && ids.has(n.data.worktree.of)
      ? [
          {
            id: `wt-${n.id}`,
            type: 'worktree' as const,
            source: n.data.worktree.of,
            sourceHandle: WORKTREE_OUT,
            target: n.id,
            targetHandle: WORKTREE_IN,
            selectable: false,
            focusable: false,
            data: { path: n.data.path }
          }
        ]
      : []
  )
}
