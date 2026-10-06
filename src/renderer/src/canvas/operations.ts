import { INSTANCE_MIN_HEIGHT, INSTANCE_WIDTH } from './factory'
import type { CanvasNode } from './types'

// Funções puras sobre a lista de nós. O React Flow exige que o grupo (pai)
// venha antes dos filhos no array, por isso nó movido vai para o fim.

// Margens internas do grupo. O nome fica fora, acima da borda.
const FIT_PADDING = { top: 24, side: 24, bottom: 24 }

function detach(node: CanvasNode, parent: CanvasNode): CanvasNode {
  const { parentId: _p, extent: _e, ...rest } = node
  return {
    ...rest,
    hidden: false,
    position: { x: parent.position.x + node.position.x, y: parent.position.y + node.position.y }
  } as CanvasNode
}

export function childrenOf(nodes: CanvasNode[], groupId: string): CanvasNode[] {
  return nodes.filter((n) => n.parentId === groupId)
}

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

export function removeNode(nodes: CanvasNode[], id: string): CanvasNode[] {
  return nodes.filter((n) => n.id !== id)
}

const GAP = 24

type Box = { x: number; y: number; width: number; height: number }

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width + GAP && b.x < a.x + a.width + GAP && a.y < b.y + b.height + GAP && b.y < a.y + a.height + GAP

// Primeiro lugar livre ao lado ou embaixo das instâncias que já estão no grupo.
// Prefere o que cabe sem aumentar o grupo; depois, o mais acima e mais à esquerda.
function findFreeSpot(occupied: Box[], size: { width: number; height: number }, groupWidth: number) {
  const start = { x: FIT_PADDING.side, y: FIT_PADDING.top }
  const candidates = [
    start,
    ...occupied.flatMap((b) => [
      { x: b.x + b.width + GAP, y: b.y },
      { x: b.x, y: b.y + b.height + GAP }
    ])
  ]
  const free = candidates.filter((c) => !occupied.some((b) => overlaps({ ...c, ...size }, b)))
  const fits = (c: { x: number }) => c.x + size.width + FIT_PADDING.side <= groupWidth
  free.sort((a, b) => Number(fits(b)) - Number(fits(a)) || a.y - b.y || a.x - b.x)
  return free[0] ?? start
}

export function moveToGroup(nodes: CanvasNode[], id: string, groupId: string | null): CanvasNode[] {
  const node = nodes.find((n) => n.id === id)
  if (!node) return nodes
  const current = nodes.find((n) => n.id === node.parentId)
  let moved = current ? detach(node, current) : node
  const rest = nodes.filter((n) => n.id !== id)

  const target = groupId ? rest.find((n) => n.id === groupId) : undefined
  if (!target || target.type !== 'area') return [...rest, moved]

  const size = sizeOf(node)
  const collapsed = !!target.data.collapsed
  const groupSize = collapsed ? (target.data.expandedSize ?? sizeOf(target)) : sizeOf(target)
  const occupied = childrenOf(rest, target.id).map((n) => ({ ...n.position, ...sizeOf(n) }))
  const spot = findFreeSpot(occupied, size, groupSize.width)

  moved = { ...moved, parentId: target.id, extent: 'parent', hidden: collapsed, position: spot }

  // O grupo só cresce, nunca encolhe, para caber a instância nova.
  const grown = {
    width: Math.max(groupSize.width, spot.x + size.width + FIT_PADDING.side),
    height: Math.max(groupSize.height, spot.y + size.height + FIT_PADDING.bottom)
  }
  const resized: CanvasNode = collapsed
    ? { ...target, data: { ...target.data, expandedSize: grown } }
    : { ...target, ...grown, style: { ...target.style, ...grown } }

  return [...rest.map((n) => (n.id === target.id ? resized : n)), moved]
}

export function rename(nodes: CanvasNode[], id: string, name: string): CanvasNode[] {
  return nodes.map((n) => {
    if (n.id !== id) return n
    if (n.type === 'area') return { ...n, data: { ...n.data, label: name } }
    if (n.type === 'terminal') return { ...n, data: { ...n.data, name } }
    return { ...n, data: { ...n.data, name } }
  })
}

export function setGroupColor(nodes: CanvasNode[], id: string, color: string): CanvasNode[] {
  return nodes.map((n) => (n.id === id && n.type === 'area' ? { ...n, data: { ...n.data, color } } : n))
}

export const COLLAPSED_SIZE = { width: 280, height: 40 }

function sizeOf(node: CanvasNode): { width: number; height: number } {
  // Instância recém-criada ainda não foi medida pelo React Flow.
  if (node.type === 'project' && !node.measured?.height) {
    return { width: INSTANCE_WIDTH, height: INSTANCE_MIN_HEIGHT }
  }
  return {
    width: node.width ?? node.measured?.width ?? Number(node.style?.width ?? 480),
    height: node.height ?? node.measured?.height ?? Number(node.style?.height ?? 320)
  }
}

// Recolhido: o grupo vira só a barra de título e as instâncias de dentro ficam escondidas.
export function toggleCollapse(nodes: CanvasNode[], id: string): CanvasNode[] {
  const group = nodes.find((n) => n.id === id)
  if (!group || group.type !== 'area') return nodes
  const collapse = !group.data.collapsed
  const size = collapse ? COLLAPSED_SIZE : (group.data.expandedSize ?? { width: 480, height: 320 })

  return nodes.map((n) => {
    if (n.parentId === id) return { ...n, hidden: collapse }
    if (n.id !== id || n.type !== 'area') return n
    return {
      ...n,
      ...size,
      selected: false,
      style: { ...n.style, ...size },
      data: {
        ...n.data,
        collapsed: collapse,
        expandedSize: collapse ? sizeOf(n) : n.data.expandedSize
      }
    }
  })
}

const GROUP_MIN_WIDTH = 320

// Redimensiona o grupo para caber exatamente nas instâncias de dentro.
// As instâncias não mudam de lugar na tela: o grupo se move e elas são compensadas.
export function fitGroupToContent(nodes: CanvasNode[], id: string): CanvasNode[] {
  const group = nodes.find((n) => n.id === id)
  const children = childrenOf(nodes, id)
  if (!group || group.type !== 'area' || children.length === 0) return nodes

  const boxes = children.map((n) => ({ x: n.position.x, y: n.position.y, ...sizeOf(n) }))
  const minX = Math.min(...boxes.map((b) => b.x))
  const minY = Math.min(...boxes.map((b) => b.y))
  const maxX = Math.max(...boxes.map((b) => b.x + b.width))
  const maxY = Math.max(...boxes.map((b) => b.y + b.height))

  const dx = minX - FIT_PADDING.side
  const dy = minY - FIT_PADDING.top
  const size = {
    width: Math.max(GROUP_MIN_WIDTH, maxX - minX + FIT_PADDING.side * 2),
    height: maxY - minY + FIT_PADDING.top + FIT_PADDING.bottom
  }

  return nodes.map((n) => {
    if (n.parentId === id) return { ...n, position: { x: n.position.x - dx, y: n.position.y - dy } }
    if (n.id !== id) return n
    return {
      ...n,
      ...size,
      position: { x: n.position.x + dx, y: n.position.y + dy },
      style: { ...n.style, ...size }
    }
  })
}

// Instância que cresceu (uma conversa nova, por exemplo) não pode ficar para fora da
// borda do grupo. O grupo acompanha sozinho: cresce só na direção em que o conteúdo
// passou e só o tanto que passou. Para cima ou para a esquerda ele anda e as instâncias
// são compensadas, para nada mudar de lugar na tela. Nunca encolhe sozinho — reduzir
// continua sendo decisão de quem arrasta a borda.
export function growGroupsToFit(nodes: CanvasNode[], changedIds: string[]): CanvasNode[] {
  const groupIds = new Set(
    changedIds.map((id) => nodes.find((n) => n.id === id)?.parentId).filter((id): id is string => !!id)
  )
  let out = nodes
  for (const groupId of groupIds) out = growGroup(out, groupId)
  return out
}

// Fração de pixel na medida do nó não conta como transbordo, senão o grupo cresceria
// a cada medição.
const overflow = (value: number) => (value >= 1 ? Math.ceil(value) : 0)

function growGroup(nodes: CanvasNode[], groupId: string): CanvasNode[] {
  const group = nodes.find((n) => n.id === groupId)
  if (!group || group.type !== 'area') return nodes
  const children = childrenOf(nodes, groupId)
  if (children.length === 0) return nodes

  const boxes = children.map((n) => ({ x: n.position.x, y: n.position.y, ...sizeOf(n) }))
  const collapsed = !!group.data.collapsed
  const size = collapsed ? (group.data.expandedSize ?? sizeOf(group)) : sizeOf(group)

  const right = overflow(Math.max(...boxes.map((b) => b.x + b.width)) + FIT_PADDING.side - size.width)
  const bottom = overflow(Math.max(...boxes.map((b) => b.y + b.height)) + FIT_PADDING.bottom - size.height)
  // Recolhido, o conteúdo está escondido: mover o grupo faria a barra saltar na tela.
  const left = collapsed ? 0 : overflow(FIT_PADDING.side - Math.min(...boxes.map((b) => b.x)))
  const top = collapsed ? 0 : overflow(FIT_PADDING.top - Math.min(...boxes.map((b) => b.y)))
  if (!right && !bottom && !left && !top) return nodes

  const grown = { width: size.width + left + right, height: size.height + top + bottom }

  return nodes.map((n) => {
    if (n.parentId === groupId)
      return left || top ? { ...n, position: { x: n.position.x + left, y: n.position.y + top } } : n
    if (n.id !== groupId || n.type !== 'area') return n
    // Recolhido, o tamanho novo fica guardado e aparece quando o grupo abrir.
    if (collapsed) return { ...n, data: { ...n.data, expandedSize: grown } }
    return {
      ...n,
      ...grown,
      position: { x: n.position.x - left, y: n.position.y - top },
      style: { ...n.style, ...grown }
    }
  })
}
