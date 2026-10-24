import type { CanvasNode } from '../types'
import { addNode } from './add'
import { detach } from './tree'

// "Mover para workspace": o bloco sai deste canvas e entra no de outro workspace.

// O bloco e o que vai junto com ele: o que está dentro (grupo) e as tarefas isoladas das pastas
// que vão, com o que estiver dentro delas.
function transferIds(nodes: CanvasNode[], id: string): Set<string> {
  const ids = new Set([id])
  for (let grew = true; grew; ) {
    grew = false
    for (const n of nodes) {
      if (ids.has(n.id)) continue
      const linked = (!!n.parentId && ids.has(n.parentId)) || (n.type === 'project' && !!n.data.worktree && ids.has(n.data.worktree.of))
      if (linked) {
        ids.add(n.id)
        grew = true
      }
    }
  }
  return ids
}

// Tira o bloco (e o que vai com ele) da lista. Os que estavam num grupo que fica saem dele no mesmo
// lugar da tela; nenhum sai selecionado.
export function takeOut(nodes: CanvasNode[], id: string): { rest: CanvasNode[]; moved: CanvasNode[] } {
  const ids = transferIds(nodes, id)
  const moved = nodes
    .filter((n) => ids.has(n.id))
    .map((n) => {
      const parent = n.parentId && !ids.has(n.parentId) ? nodes.find((p) => p.id === n.parentId) : undefined
      const { selected: _s, ...clean } = parent ? detach(n, parent) : n
      return clean as CanvasNode
    })
  return { rest: nodes.filter((n) => !ids.has(n.id)), moved }
}

// Os blocos chegam ao outro canvas: o principal num lugar livre (addNode) e os outros na mesma
// disposição em volta dele. Os de dentro de um grupo guardam a posição relativa e vão junto sozinhos.
// Algum id que já esteja lá: nada entra (dois blocos com o mesmo id se confundem).
export function bringIn(nodes: CanvasNode[], moved: CanvasNode[], rootId: string): CanvasNode[] {
  const root = moved.find((n) => n.id === rootId)
  if (!root || moved.some((m) => nodes.some((n) => n.id === m.id))) return nodes
  const placed = addNode(nodes, root)
  const at = placed.find((n) => n.id === rootId)?.position ?? root.position
  const dx = at.x - root.position.x
  const dy = at.y - root.position.y
  const others = moved
    .filter((n) => n.id !== rootId)
    .map((n) => (n.parentId ? n : ({ ...n, position: { x: n.position.x + dx, y: n.position.y + dy } } as CanvasNode)))
  return [...placed, ...others]
}
