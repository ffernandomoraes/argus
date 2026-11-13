import type { AreaNode, CanvasNode } from '../types'
import { findFreeSpot, freeSpot } from './freeSpace'
import { boxOf, FIT_PADDING, GAP, isPlaced, sizeOf } from './geometry'
import { fitGroupToContent, growGroupsToFit } from './groupSize'
import { pushAway } from './push'
import { childrenOf, detach } from './tree'

// Entrar e sair de grupos. O React Flow exige que o grupo (pai) venha antes dos filhos no
// array, por isso nó movido vai para o fim. O bloco movido sai da lista pela referência, e não
// pelo id: com id repetido (arquivo estragado), o outro bloco não some junto.

export function ungroup(nodes: CanvasNode[], groupId: string): CanvasNode[] {
  const group = nodes.find((n) => n.id === groupId)
  if (!group) return nodes
  return nodes
    .filter((n) => n.id !== groupId)
    .map((n) => (n.parentId === groupId ? detach(n, group) : n))
}

export function removeGroup(nodes: CanvasNode[], groupId: string): CanvasNode[] {
  return nodes.filter((n) => n.id !== groupId && n.parentId !== groupId)
}

// Terminais que saem do canvas junto com o grupo. O processo não morre quando o bloco some da
// tela (de propósito: recolher o grupo também desmonta o terminal), então quem exclui o grupo
// precisa encerrá-los.
export function terminalsIn(nodes: CanvasNode[], groupId: string): string[] {
  return childrenOf(nodes, groupId)
    .filter((n) => n.type === 'terminal')
    .map((n) => n.id)
}

export function moveToGroup(nodes: CanvasNode[], id: string, groupId: string | null): CanvasNode[] {
  const node = nodes.find((n) => n.id === id)
  if (!node) return nodes
  const current = nodes.find((n) => n.id === node.parentId)
  let moved = current ? detach(node, current) : node
  const rest = nodes.filter((n) => n !== node)

  const target = groupId ? rest.find((n) => n.id === groupId) : undefined
  if (!target || target.type !== 'area') return [...rest, moved]

  const box = boxOf({ ...node, position: { x: 0, y: 0 } })
  const size = { width: box.width, height: box.height }
  const collapsed = !!target.data.collapsed
  const groupSize = collapsed ? (target.data.expandedSize ?? sizeOf(target)) : sizeOf(target)
  const occupied = childrenOf(rest, target.id).filter(isPlaced).map(boxOf)
  const spot = findFreeSpot(occupied, size, groupSize.width)
  // O lugar livre é para a caixa visual; o nó fica deslocado do que desenha por fora.
  const position = { x: spot.x - box.x, y: spot.y - box.y }

  moved = { ...moved, parentId: target.id, extent: 'parent', hidden: collapsed, position }

  // O grupo só cresce, nunca encolhe, para caber a instância nova.
  const grown = {
    width: Math.max(groupSize.width, spot.x + size.width + FIT_PADDING.side),
    height: Math.max(groupSize.height, spot.y + size.height + FIT_PADDING.bottom)
  }
  const resized: CanvasNode = collapsed
    ? { ...target, data: { ...target.data, expandedSize: grown } }
    : { ...target, ...grown, style: { ...target.style, ...grown } }

  const next = [...rest.map((n) => (n === target ? resized : n)), moved]
  return collapsed ? next : pushAway(next, [target.id])
}

// Bloco solto arrastado para cima de um grupo entra nele quando o centro do bloco cai dentro
// do grupo. Fica onde foi solto; se passar da borda, o grupo cresce até ele. Grupo recolhido não
// mostra onde soltar: o bloco vai para o lugar livre (moveToGroup). De dentro para fora não
// existe: levar o bloco até a borda faz o grupo crescer (expandParent, no Canvas).
export function dropIntoGroup(nodes: CanvasNode[], ids: string[]): CanvasNode[] {
  let out = nodes
  for (const id of ids) {
    const node = out.find((n) => n.id === id)
    const group = node && groupUnder(out, node)
    if (!node || !group) continue
    if (group.data.collapsed) {
      out = moveToGroup(out, id, group.id)
      continue
    }
    const position = { x: node.position.x - group.position.x, y: node.position.y - group.position.y }
    const inside = { ...node, parentId: group.id, extent: 'parent', position } as CanvasNode
    out = pushAway(growGroupsToFit([...out.filter((n) => n !== node), inside], [id]), [group.id])
  }
  return out
}

// Grupo que recebe o bloco solto se ele for largado onde está: o que contém o centro do bloco.
// Grupos sobrepostos: vale o desenhado por cima (o último da lista).
export function groupUnder(nodes: CanvasNode[], node: CanvasNode): AreaNode | undefined {
  if (node.parentId || node.type === 'area' || !isPlaced(node)) return undefined
  const { width, height } = sizeOf(node)
  const center = { x: node.position.x + width / 2, y: node.position.y + height / 2 }
  return [...nodes].reverse().find((g): g is AreaNode => {
    if (g.type !== 'area' || g.hidden || !isPlaced(g)) return false
    const s = sizeOf(g)
    const { x, y } = g.position
    return center.x >= x && center.x <= x + s.width && center.y >= y && center.y <= y + s.height
  })
}

// "Tirar do grupo": o grupo encolhe para caber só o que ficou nele e o bloco vai para fora,
// à direita do grupo e alinhado pelo topo, descendo até achar lugar livre.
export function leaveGroup(nodes: CanvasNode[], id: string): CanvasNode[] {
  const node = nodes.find((n) => n.id === id)
  const group = nodes.find((n) => n.id === node?.parentId)
  if (!node || !group || group.type !== 'area' || !isPlaced(group)) return nodes
  const others = nodes.filter((n) => n !== node)
  // Recolhido, o tamanho na tela é o da barra: encolher pelo conteúdo o abriria pela metade.
  const rest = group.data.collapsed ? others : fitGroupToContent(others, group.id)
  const g = boxOf(rest.find((n) => n.id === group.id) ?? group)
  // O nó fica deslocado do que desenha por fora (PROJECT_OUTSET).
  const offset = boxOf({ ...node, position: { x: 0, y: 0 } })
  const { parentId: _p, extent: _e, ...loose } = node
  const outside = {
    ...loose,
    hidden: false,
    position: { x: g.x + g.width + GAP - offset.x, y: g.y - offset.y }
  } as CanvasNode
  return [...rest, { ...outside, position: freeSpot(rest, outside) } as CanvasNode]
}
