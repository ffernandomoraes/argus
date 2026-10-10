import type { CanvasNode } from '../types'
import { freeSpot, freeY } from './freeSpace'
import { boxOf, GAP, isPlaced } from './geometry'
import { growGroupsToFit } from './groupSize'
import { moveToGroup } from './groups'
import { pushAway } from './push'

// Bloco cujo id já está na lista não entra de novo: dois blocos com o mesmo id se confundem
// (o React Flow só desenha um, e as operações mexeriam no outro).
const present = (nodes: CanvasNode[], node: CanvasNode) => nodes.some((n) => n.id === node.id)

// Bloco novo entra na lista: num grupo, no lugar livre dele (o grupo cresce e empurra os
// vizinhos); solto, na posição pedida ou, se ela encostar em outro bloco, descendo até ficar livre.
// Grupo entra no início do array para ficar atrás dos blocos soltos.
export function addNode(nodes: CanvasNode[], node: CanvasNode, groupId?: string): CanvasNode[] {
  if (present(nodes, node)) return nodes
  if (groupId) return moveToGroup([...nodes, node], node.id, groupId)
  const placed = { ...node, position: freeSpot(nodes, node) } as CanvasNode
  return placed.type === 'area' ? [placed, ...nodes] : [...nodes, placed]
}

// Bloco que nasce de outro (a conversa posta no canvas a partir da pasta): à direita dele,
// alinhado pelo topo e no mesmo grupo. Se encostar num vizinho, desce até ficar livre; dentro
// de um grupo, o grupo cresce para caber e empurra os blocos de fora.
export function placeBeside(nodes: CanvasNode[], anchorId: string, node: CanvasNode): CanvasNode[] {
  if (present(nodes, node)) return nodes
  const anchor = nodes.find((n) => n.id === anchorId)
  if (!anchor || !isPlaced(anchor)) return addNode(nodes, node)
  const a = boxOf(anchor)
  const offset = boxOf({ ...node, position: { x: 0, y: 0 } })
  const box = { ...offset, x: a.x + a.width + GAP, y: a.y }
  const occupied = nodes.filter((n) => n.parentId === anchor.parentId && isPlaced(n)).map(boxOf)
  const position = { x: box.x - offset.x, y: freeY(box, occupied) - offset.y }
  const group = nodes.find((n) => n.id === anchor.parentId)
  if (group?.type !== 'area') return [...nodes, { ...node, position } as CanvasNode]
  const collapsed = !!group.data.collapsed
  const inside = { ...node, parentId: group.id, extent: 'parent', hidden: collapsed, position } as CanvasNode
  const grown = growGroupsToFit([...nodes, inside], [inside.id])
  return collapsed ? grown : pushAway(grown, [group.id])
}
