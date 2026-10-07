import { AREA_OUTSET, CHAT_SIZE, INSTANCE_MIN_HEIGHT, INSTANCE_WIDTH, PROJECT_OUTSET } from './factory'
import type { XYPosition } from '@xyflow/react'
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

  const box = boxOf({ ...node, position: { x: 0, y: 0 } })
  const size = { width: box.width, height: box.height }
  const collapsed = !!target.data.collapsed
  const groupSize = collapsed ? (target.data.expandedSize ?? sizeOf(target)) : sizeOf(target)
  const occupied = childrenOf(rest, target.id).map(boxOf)
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

  const next = [...rest.map((n) => (n.id === target.id ? resized : n)), moved]
  return collapsed ? next : pushAway(next, [target.id])
}

// Bloco novo entra na lista: num grupo, no lugar livre dele (o grupo cresce e empurra os
// vizinhos); solto, na posição pedida ou, se ela encostar em outro bloco, descendo até ficar livre.
// Grupo entra no início do array para ficar atrás dos blocos soltos.
export function addNode(nodes: CanvasNode[], node: CanvasNode, groupId?: string): CanvasNode[] {
  if (groupId) return moveToGroup([...nodes, node], node.id, groupId)
  const placed = { ...node, position: freeSpot(nodes, node) } as CanvasNode
  return placed.type === 'area' ? [placed, ...nodes] : [...nodes, placed]
}

// Posição do nó descida até a caixa dele não encostar em nenhum bloco solto.
function freeSpot(nodes: CanvasNode[], node: CanvasNode): XYPosition {
  const occupied = nodes.filter((n) => !n.parentId && !n.hidden).map(boxOf)
  const box = boxOf(node)
  for (let b = occupied.find((o) => overlaps(box, o)); b; b = occupied.find((o) => overlaps(box, o))) {
    box.y = b.y + b.height + GAP
  }
  return { x: node.position.x, y: node.position.y + box.y - boxOf(node).y }
}

// Bloco solto (grupo, pasta, terminal) que cresceu não fica por cima de outro: quem encosta
// é empurrado para longe, pelo lado em que precisa andar menos, e empurra os seguintes.
// Os blocos de `ids` ficam parados.
export function pushAway(nodes: CanvasNode[], ids: string[]): CanvasNode[] {
  const boxes = new Map(nodes.filter((n) => !n.parentId && !n.hidden).map((n) => [n.id, boxOf(n)]))
  const fixed = new Set(ids.filter((id) => boxes.has(id)))
  const queue = [...fixed]
  const deltas = new Map<string, XYPosition>()
  // Teto de segurança contra empurrões em ciclo.
  for (let guard = 0; queue.length && guard < 500; guard++) {
    const a = boxes.get(queue.shift()!)!
    for (const [id, b] of boxes) {
      if (b === a || fixed.has(id) || !overlaps(a, b)) continue
      const d = pushVector(a, b)
      b.x += d.x
      b.y += d.y
      const total = deltas.get(id) ?? { x: 0, y: 0 }
      deltas.set(id, { x: total.x + d.x, y: total.y + d.y })
      queue.push(id)
    }
  }
  if (!deltas.size) return nodes
  return nodes.map((n) => {
    const d = deltas.get(n.id)
    return d ? ({ ...n, position: { x: n.position.x + d.x, y: n.position.y + d.y } } as CanvasNode) : n
  })
}

// Menor deslocamento que tira `b` de cima de `a`, sempre para o lado em que `b` já está.
function pushVector(a: Box, b: Box): XYPosition {
  const below = b.y + b.height / 2 >= a.y + a.height / 2
  const right = b.x + b.width / 2 >= a.x + a.width / 2
  const vertical = below ? a.y + a.height + GAP - b.y : a.y - GAP - (b.y + b.height)
  const horizontal = right ? a.x + a.width + GAP - b.x : a.x - GAP - (b.x + b.width)
  return Math.abs(vertical) <= Math.abs(horizontal) ? { x: 0, y: vertical } : { x: horizontal, y: 0 }
}

export function rename(nodes: CanvasNode[], id: string, name: string): CanvasNode[] {
  return nodes.map((n) => {
    if (n.id !== id) return n
    if (n.type === 'area') return { ...n, data: { ...n.data, label: name } }
    if (n.type === 'terminal') return { ...n, data: { ...n.data, name } }
    if (n.type === 'chat') return { ...n, data: { ...n.data, name } }
    return { ...n, data: { ...n.data, name } }
  })
}

export function setGroupColor(nodes: CanvasNode[], id: string, color: string): CanvasNode[] {
  return nodes.map((n) => (n.id === id && n.type === 'area' ? { ...n, data: { ...n.data, color } } : n))
}

export const COLLAPSED_SIZE = { width: 280, height: 40 }


export function sizeOf(node: CanvasNode): { width: number; height: number } {
  // Instância recém-criada ainda não foi medida pelo React Flow.
  if (node.type === 'project' && !node.measured?.height) {
    return { width: INSTANCE_WIDTH, height: INSTANCE_MIN_HEIGHT }
  }
  if (node.type === 'chat' && !node.measured?.height) return { ...CHAT_SIZE }
  return {
    width: node.width ?? node.measured?.width ?? Number(node.style?.width ?? 480),
    height: node.height ?? node.measured?.height ?? Number(node.style?.height ?? 320)
  }
}

// Caixa que o nó ocupa na tela, contando o que ele desenha fora de si (PROJECT_OUTSET, AREA_OUTSET).
function boxOf(node: CanvasNode): Box {
  const { width, height } = sizeOf(node)
  const out = node.type === 'project' ? PROJECT_OUTSET : node.type === 'area' ? AREA_OUTSET : { left: 0, top: 0 }
  return {
    x: node.position.x - out.left,
    y: node.position.y - out.top,
    width: width + out.left,
    height: height + out.top
  }
}

// Onde entra a conversa solta nova. Clique com o botão direito num lugar livre vale como
// pedido de posição. Senão: embaixo da última conversa solta ou, se for a primeira, à direita
// do último grupo criado, alinhada pelo topo. Se encostar em algum bloco, desce até ficar livre.
export function findChatSpot(nodes: CanvasNode[], requested?: XYPosition): XYPosition {
  const top = nodes.filter((n) => !n.parentId)
  const occupied = top.map(boxOf)
  const hit = (p: XYPosition) => occupied.find((b) => overlaps({ ...p, ...CHAT_SIZE }, b))
  if (requested && !hit(requested)) return requested

  const lastChat = [...top].reverse().find((n) => n.type === 'chat')
  // Grupo novo entra no início da lista (para ficar atrás dos blocos): o primeiro é o mais recente.
  const anchor = lastChat ?? top.find((n) => n.type === 'area') ?? top.at(-1)
  if (!anchor) return requested ?? { x: 0, y: 0 }
  const a = boxOf(anchor)
  const spot = lastChat ? { x: a.x, y: a.y + a.height + GAP } : { x: a.x + a.width + GAP, y: a.y }
  for (let b = hit(spot); b; b = hit(spot)) spot.y = b.y + b.height + GAP
  return spot
}

// Recolhido: o grupo vira só a barra de título e as instâncias de dentro ficam escondidas.
export function toggleCollapse(nodes: CanvasNode[], id: string): CanvasNode[] {
  const group = nodes.find((n) => n.id === id)
  if (!group || group.type !== 'area') return nodes
  const collapse = !group.data.collapsed
  const size = collapse ? COLLAPSED_SIZE : (group.data.expandedSize ?? { width: 480, height: 320 })

  const next = nodes.map((n) => {
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
  // Ao abrir, o grupo volta ao tamanho cheio e pode ter ganhado vizinho no espaço livre.
  return collapse ? next : pushAway(next, [id])
}

// Pasta recolhida: a lista de conversas encolhe para as que pedem atenção.
export function toggleProjectCollapse(nodes: CanvasNode[], id: string): CanvasNode[] {
  return nodes.map((n) =>
    n.id === id && n.type === 'project' ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } } : n
  )
}

const GROUP_MIN_WIDTH = 320

// Redimensiona o grupo para caber exatamente nas instâncias de dentro.
// As instâncias não mudam de lugar na tela: o grupo se move e elas são compensadas.
export function fitGroupToContent(nodes: CanvasNode[], id: string): CanvasNode[] {
  const group = nodes.find((n) => n.id === id)
  const children = childrenOf(nodes, id)
  if (!group || group.type !== 'area' || children.length === 0) return nodes

  const boxes = children.map(boxOf)
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

  const next = nodes.map((n) => {
    if (n.parentId === id) return { ...n, position: { x: n.position.x - dx, y: n.position.y - dy } }
    if (n.id !== id) return n
    return {
      ...n,
      ...size,
      position: { x: n.position.x + dx, y: n.position.y + dy },
      style: { ...n.style, ...size }
    }
  })
  return pushAway(next, [id])
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

// Depois de uma medição: o grupo cresce para caber o conteúdo e, junto com o bloco solto que
// cresceu (pasta com conversa nova, por exemplo), empurra os vizinhos. Grupo redimensionado
// na mão não entra: é decisão de quem arrasta a borda.
export function fitAfterResize(before: CanvasNode[], after: CanvasNode[], resizedIds: string[]): CanvasNode[] {
  const grown = growGroupsToFit(after, resizedIds)
  const pushers = new Set<string>()
  grown.forEach((n, i) => n.type === 'area' && n !== after[i] && pushers.add(n.id))
  for (const id of resizedIds) {
    const prev = before.find((n) => n.id === id)
    const next = grown.find((n) => n.id === id)
    // Sem medida anterior é a primeira medição (ao abrir o app), não crescimento.
    if (!prev?.measured?.height || !next || next.parentId || next.type === 'area') continue
    const a = sizeOf(prev)
    const b = sizeOf(next)
    if (b.width > a.width || b.height > a.height) pushers.add(id)
  }
  return pushers.size ? pushAway(grown, [...pushers]) : grown
}

// Fração de pixel na medida do nó não conta como transbordo, senão o grupo cresceria
// a cada medição.
const overflow = (value: number) => (value >= 1 ? Math.ceil(value) : 0)

function growGroup(nodes: CanvasNode[], groupId: string): CanvasNode[] {
  const group = nodes.find((n) => n.id === groupId)
  if (!group || group.type !== 'area') return nodes
  const children = childrenOf(nodes, groupId)
  if (children.length === 0) return nodes

  const boxes = children.map(boxOf)
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
