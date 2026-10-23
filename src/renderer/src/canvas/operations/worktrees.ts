import type { CanvasNode, ProjectNode } from '../types'
import { placeBelow } from './add'

// Tarefas isoladas (git worktree): cards filhos de uma pasta (ProjectData.worktree.of). Não usam o
// parentId do React Flow, que é do grupo (e uma pasta dentro de um grupo já usa o dela): andar
// junto e recolher junto são feitos aqui.

const childOf = (n: CanvasNode, id: string): n is ProjectNode => n.type === 'project' && n.data.worktree?.of === id

export const worktreesOf = (nodes: CanvasNode[], id: string): ProjectNode[] => nodes.filter((n) => childOf(n, id))

// Card de tarefa novo embaixo da pasta. Pasta recolhida esconderia a tarefa recém-criada: abre.
export function addWorktreeCard(nodes: CanvasNode[], parentId: string, node: ProjectNode): CanvasNode[] {
  const opened = nodes.map((n) => (n.id === parentId && n.type === 'project' && n.data.collapsed ? { ...n, data: { ...n.data, collapsed: false } } : n))
  return placeBelow(opened, parentId, node)
}

// Depois de um arraste: a pasta que andou leva os filhos (e os filhos deles) o mesmo tanto. Filho
// que também foi arrastado (seleção com os dois) já andou sozinho.
export function followParents(before: CanvasNode[], after: CanvasNode[]): CanvasNode[] {
  if (!after.some((n) => n.type === 'project' && n.data.worktree)) return after
  const old = new Map(before.map((n) => [n.id, n.position]))
  const delta = new Map<string, { x: number; y: number }>()
  for (const n of after) {
    const p = old.get(n.id)
    if (n.type === 'project' && p && (p.x !== n.position.x || p.y !== n.position.y)) delta.set(n.id, { x: n.position.x - p.x, y: n.position.y - p.y })
  }
  if (!delta.size) return after
  const shift = new Map<string, { x: number; y: number }>()
  // Desce a árvore: filho de filho anda junto também.
  let frontier = [...delta.keys()]
  while (frontier.length) {
    const next: string[] = []
    for (const id of frontier) {
      const d = shift.get(id) ?? delta.get(id)!
      for (const child of worktreesOf(after, id)) {
        if (delta.has(child.id) || shift.has(child.id)) continue
        shift.set(child.id, d)
        next.push(child.id)
      }
    }
    frontier = next
  }
  if (!shift.size) return after
  return after.map((n) => {
    const d = shift.get(n.id)
    return d ? { ...n, position: { x: n.position.x + d.x, y: n.position.y + d.y } } : n
  })
}

// Filhos que somem da tela porque a pasta (ou uma acima dela) está recolhida.
export function hiddenWorktrees(nodes: CanvasNode[]): Set<string> {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const hidden = new Set<string>()
  for (const n of nodes) {
    if (n.type !== 'project' || !n.data.worktree) continue
    const seen = new Set<string>()
    for (let parent = byId.get(n.data.worktree.of); parent?.type === 'project' && !seen.has(parent.id); ) {
      seen.add(parent.id)
      if (parent.data.collapsed) {
        hidden.add(n.id)
        break
      }
      parent = parent.data.worktree ? byId.get(parent.data.worktree.of) : undefined
    }
  }
  return hidden
}
