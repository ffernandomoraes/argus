import { AREA_OUTSET, CHAT_SIZE, INSTANCE_MIN_HEIGHT, INSTANCE_WIDTH, NOTE_SIZE, PROJECT_OUTSET } from './factory'
import type { XYPosition } from '@xyflow/react'
import type { AreaNode, CanvasNode } from './types'

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
    out = pushAway(growGroupsToFit([...out.filter((n) => n.id !== id), inside], [id]), [group.id])
  }
  return out
}

// Grupo que recebe o bloco solto se ele for largado onde está: o que contém o centro do bloco.
// Grupos sobrepostos: vale o desenhado por cima (o último da lista).
export function groupUnder(nodes: CanvasNode[], node: CanvasNode): AreaNode | undefined {
  if (node.parentId || node.type === 'area') return undefined
  const { width, height } = sizeOf(node)
  const center = { x: node.position.x + width / 2, y: node.position.y + height / 2 }
  return [...nodes].reverse().find((g): g is AreaNode => {
    if (g.type !== 'area' || g.hidden) return false
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
  if (!node || !group || group.type !== 'area') return nodes
  const others = nodes.filter((n) => n.id !== id)
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

// Bloco novo entra na lista: num grupo, no lugar livre dele (o grupo cresce e empurra os
// vizinhos); solto, na posição pedida ou, se ela encostar em outro bloco, descendo até ficar livre.
// Grupo entra no início do array para ficar atrás dos blocos soltos.
export function addNode(nodes: CanvasNode[], node: CanvasNode, groupId?: string): CanvasNode[] {
  if (groupId) return moveToGroup([...nodes, node], node.id, groupId)
  const placed = { ...node, position: freeSpot(nodes, node) } as CanvasNode
  return placed.type === 'area' ? [placed, ...nodes] : [...nodes, placed]
}

// Bloco que nasce de outro (a conversa posta no canvas a partir da pasta): à direita dele,
// alinhado pelo topo e no mesmo grupo. Se encostar num vizinho, desce até ficar livre; dentro
// de um grupo, o grupo cresce para caber e empurra os blocos de fora.
export function placeBeside(nodes: CanvasNode[], anchorId: string, node: CanvasNode): CanvasNode[] {
  const anchor = nodes.find((n) => n.id === anchorId)
  if (!anchor) return addNode(nodes, node)
  const a = boxOf(anchor)
  const offset = boxOf({ ...node, position: { x: 0, y: 0 } })
  const box = { ...offset, x: a.x + a.width + GAP, y: a.y }
  const occupied = nodes.filter((n) => n.parentId === anchor.parentId).map(boxOf)
  for (let b = occupied.find((o) => overlaps(box, o)); b; b = occupied.find((o) => overlaps(box, o))) {
    box.y = b.y + b.height + GAP
  }
  const position = { x: box.x - offset.x, y: box.y - offset.y }
  const group = nodes.find((n) => n.id === anchor.parentId)
  if (group?.type !== 'area') return [...nodes, { ...node, position } as CanvasNode]
  const collapsed = !!group.data.collapsed
  const inside = { ...node, parentId: group.id, extent: 'parent', hidden: collapsed, position } as CanvasNode
  const grown = growGroupsToFit([...nodes, inside], [inside.id])
  return collapsed ? grown : pushAway(grown, [group.id])
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
    if (n.type === 'chatPanel') return { ...n, data: { ...n.data, name } }
    if (n.type === 'note') return { ...n, data: { ...n.data, text: name } }
    return { ...n, data: { ...n.data, name } }
  })
}

export function setGroupColor(nodes: CanvasNode[], id: string, color: string): CanvasNode[] {
  return nodes.map((n) => (n.id === id && n.type === 'area' ? { ...n, data: { ...n.data, color } } : n))
}

export function setNoteText(nodes: CanvasNode[], id: string, text: string): CanvasNode[] {
  return nodes.map((n) => (n.id === id && n.type === 'note' ? { ...n, data: { ...n.data, text } } : n))
}

export function setNoteWidth(nodes: CanvasNode[], id: string, width: number): CanvasNode[] {
  return nodes.map((n) => (n.id === id && n.type === 'note' ? { ...n, data: { ...n.data, width } } : n))
}

export function setNoteColor(nodes: CanvasNode[], id: string, color: string): CanvasNode[] {
  return nodes.map((n) => (n.id === id && n.type === 'note' ? { ...n, data: { ...n.data, color } } : n))
}

export function setGroupAccount(nodes: CanvasNode[], id: string, account: string): CanvasNode[] {
  return nodes.map((n) => (n.id === id && n.type === 'area' ? { ...n, data: { ...n.data, account } } : n))
}

// Conta escolhida no grupo onde o bloco está; fora de grupo, nenhuma (vale a padrão).
export function groupAccount(nodes: CanvasNode[], node: CanvasNode | undefined): string | undefined {
  const group = node?.parentId ? nodes.find((n) => n.id === node.parentId) : undefined
  return group?.type === 'area' ? group.data.account : undefined
}

export const COLLAPSED_SIZE = { width: 280, height: 40 }


export function sizeOf(node: CanvasNode): { width: number; height: number } {
  // Instância recém-criada ainda não foi medida pelo React Flow.
  if (node.type === 'project' && !node.measured?.height) {
    return { width: INSTANCE_WIDTH, height: INSTANCE_MIN_HEIGHT }
  }
  if (node.type === 'chat' && !node.measured?.height) return { ...CHAT_SIZE }
  if (node.type === 'note' && !node.measured?.height) return { ...NOTE_SIZE }
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

// Conteúdo oculto: as instâncias continuam no lugar, só não aparecem.
export function toggleObscure(nodes: CanvasNode[], id: string): CanvasNode[] {
  return nodes.map((n) =>
    n.id === id && n.type === 'area' ? { ...n, data: { ...n.data, obscured: !n.data.obscured } } : n
  )
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
  const next = fitGroup(nodes, id)
  return next === nodes ? nodes : pushAway(next, [id])
}

function fitGroup(nodes: CanvasNode[], id: string): CanvasNode[] {
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

// Respiro entre os blocos ao organizar: no board, maior que o GAP, para os grupos não se colarem.
const BOARD_GAP = 64
const GROUP_GAP = 32

// Nota cujo centro cai em cima de outro bloco da lista é lembrete sobre ele: sai da arrumação
// e anda junto com ele (riders: bloco → notas).
function splitRiders(list: CanvasNode[], boxes: Map<string, Box>) {
  const riders = new Map<string, string[]>()
  const blocks = list.filter((n) => {
    if (n.type !== 'note') return true
    const b = boxes.get(n.id)!
    const cx = b.x + b.width / 2
    const cy = b.y + b.height / 2
    const host = list.find((h) => {
      const hb = boxes.get(h.id)!
      return h.type !== 'note' && cx >= hb.x && cx <= hb.x + hb.width && cy >= hb.y && cy <= hb.y + hb.height
    })
    if (!host) return true
    riders.set(host.id, [...(riders.get(host.id) ?? []), n.id])
    return false
  })
  return { blocks, riders }
}

// Põe as seções em linhas, da esquerda para a direita e quebrando para baixo; cada seção começa
// numa linha nova. A largura da linha é a que deixa o conjunto maior numa tela de proporção
// `aspect` (largura/altura); no empate, a mais estreita. Devolve o deslocamento de cada bloco
// (e das notas que andam com ele) para a arrumação começar em `origin`.
function arrangeInRows(
  sections: CanvasNode[][],
  boxes: Map<string, Box>,
  riders: Map<string, string[]>,
  origin: XYPosition,
  gap: number,
  aspect: number
): Map<string, XYPosition> {
  const all = sections.flat()
  const firsts = new Set(sections.slice(1).map((s) => s[0]))

  const layout = (rowWidth: number) => {
    const spots = new Map<string, XYPosition>()
    const cursor = { x: 0, y: 0 }
    let rowHeight = 0
    let width = 0
    for (const n of all) {
      const b = boxes.get(n.id)!
      if (cursor.x > 0 && (cursor.x + b.width > rowWidth || firsts.has(n))) {
        cursor.x = 0
        cursor.y += rowHeight + gap
        rowHeight = 0
      }
      spots.set(n.id, { ...cursor })
      width = Math.max(width, cursor.x + b.width)
      cursor.x += b.width + gap
      rowHeight = Math.max(rowHeight, b.height)
    }
    return { spots, width, height: cursor.y + rowHeight }
  }

  // Larguras candidatas: a de cada começo de lista posto lado a lado.
  const candidates: number[] = []
  let sum = -gap
  for (const n of all) candidates.push((sum += boxes.get(n.id)!.width + gap))
  const best = candidates
    .map(layout)
    .reduce((a, b) => (Math.max(b.width / aspect, b.height) < Math.max(a.width / aspect, a.height) ? b : a))

  const deltas = new Map<string, XYPosition>()
  for (const n of all) {
    const b = boxes.get(n.id)!
    const spot = best.spots.get(n.id)!
    const d = { x: origin.x + spot.x - b.x, y: origin.y + spot.y - b.y }
    deltas.set(n.id, d)
    for (const id of riders.get(n.id) ?? []) deltas.set(id, d)
  }
  return deltas
}

function shift(nodes: CanvasNode[], deltas: Map<string, XYPosition>): CanvasNode[] {
  return nodes.map((n) => {
    const d = deltas.get(n.id)
    return d && (d.x || d.y) ? ({ ...n, position: { x: n.position.x + d.x, y: n.position.y + d.y } } as CanvasNode) : n
  })
}

const readingOrder = (boxes: Map<string, Box>) => (a: CanvasNode, b: CanvasNode) => {
  const ba = boxes.get(a.id)!
  const bb = boxes.get(b.id)!
  return ba.y - bb.y || ba.x - bb.x
}

// "Organizar board": cada grupo aberto encolhe para caber o que tem dentro e os blocos de fora
// (grupos primeiro, depois os soltos, numa linha nova) vão para linhas, na ordem de leitura em
// que já estavam. O que está dentro dos grupos não muda de lugar.
export function organizeBoard(nodes: CanvasNode[], aspect = 16 / 10): CanvasNode[] {
  let out = nodes
  for (const g of nodes) if (g.type === 'area' && !g.data.collapsed) out = fitGroup(out, g.id)

  const top = out.filter((n) => !n.parentId && !n.hidden)
  if (top.length < 2) return out
  const boxes = new Map(top.map((n) => [n.id, boxOf(n)]))
  const { blocks, riders } = splitRiders(top, boxes)
  const reading = readingOrder(boxes)
  const groups = blocks.filter((n) => n.type === 'area').sort(reading)
  const loose = blocks.filter((n) => n.type !== 'area').sort(reading)
  const origin = {
    x: Math.min(...blocks.map((n) => boxes.get(n.id)!.x)),
    y: Math.min(...blocks.map((n) => boxes.get(n.id)!.y))
  }
  const sections = [groups, loose].filter((s) => s.length)
  return shift(out, arrangeInRows(sections, boxes, riders, origin, BOARD_GAP, aspect))
}

// "Organizar grupo": o mesmo, com os blocos de dentro do grupo, a partir do canto dele. O grupo
// encolhe (ou cresce) para caber, sem sair do lugar, e empurra os vizinhos se crescer.
export function organizeGroup(nodes: CanvasNode[], groupId: string, aspect = 16 / 10): CanvasNode[] {
  const group = nodes.find((n) => n.id === groupId)
  const children = childrenOf(nodes, groupId)
  if (group?.type !== 'area' || group.data.collapsed || !children.length) return nodes
  const boxes = new Map(children.map((n) => [n.id, boxOf(n)]))
  const { blocks, riders } = splitRiders(children, boxes)
  const origin = { x: FIT_PADDING.side, y: FIT_PADDING.top }
  const deltas = arrangeInRows([blocks.sort(readingOrder(boxes))], boxes, riders, origin, GROUP_GAP, aspect)
  return fitGroupToContent(shift(nodes, deltas), groupId)
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

// Depois de uma medição (ou de um arraste dentro do grupo): o grupo cresce para caber o conteúdo e, junto com o bloco solto que
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
