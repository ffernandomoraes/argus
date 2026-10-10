import type { XYPosition } from '@xyflow/react'
import type { CanvasNode } from '../types'
import { boxOf, FIT_PADDING, isPlaced, STILL, type Box } from './geometry'
import { fitGroup, fitGroupToContent } from './groupSize'
import { childrenOf } from './tree'

// "Organizar board" e "Organizar grupo": os blocos vão para linhas, na ordem de leitura.

// Respiro entre os blocos ao organizar. Na vertical precisa caber o que sai acima de cada bloco:
// o rótulo de branch do projeto (30px) e a etiqueta do grupo (12px).
const BOARD_GAP = { x: 32, y: 40 }
const GROUP_GAP = { x: 24, y: 32 }

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
  gap: { x: number; y: number },
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
        cursor.y += rowHeight + gap.y
        rowHeight = 0
      }
      spots.set(n.id, { ...cursor })
      width = Math.max(width, cursor.x + b.width)
      cursor.x += b.width + gap.x
      rowHeight = Math.max(rowHeight, b.height)
    }
    return { spots, width, height: cursor.y + rowHeight }
  }

  // Larguras candidatas: a de cada começo de lista posto lado a lado.
  const candidates: number[] = []
  let sum = -gap.x
  for (const n of all) candidates.push((sum += boxes.get(n.id)!.width + gap.x))
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

// Nada saiu do lugar (organizar de novo o que já está organizado): a mesma lista, sem passo no ⌘Z.
function shift(nodes: CanvasNode[], deltas: Map<string, XYPosition>): CanvasNode[] {
  let moved = false
  const next = nodes.map((n) => {
    const d = deltas.get(n.id)
    if (!d || (Math.abs(d.x) < STILL && Math.abs(d.y) < STILL)) return n
    moved = true
    return { ...n, position: { x: n.position.x + d.x, y: n.position.y + d.y } } as CanvasNode
  })
  return moved ? next : nodes
}

// De cima para baixo e, na mesma linha, da esquerda para a direita. Topos iguais até uma fração
// de pixel são a mesma linha: depois de organizar, a sobra das contas com frações não pode trocar
// a ordem de quem ficou lado a lado (organizar de novo mudaria tudo).
const readingOrder = (boxes: Map<string, Box>) => (a: CanvasNode, b: CanvasNode) => {
  const ba = boxes.get(a.id)!
  const bb = boxes.get(b.id)!
  return Math.abs(ba.y - bb.y) < STILL ? ba.x - bb.x : ba.y - bb.y
}

// "Organizar board": cada grupo aberto encolhe para caber o que tem dentro e os blocos de fora
// (grupos primeiro, depois os soltos, numa linha nova) vão para linhas, na ordem de leitura em
// que já estavam. O que está dentro dos grupos não muda de lugar.
export function organizeBoard(nodes: CanvasNode[], aspect = 16 / 10): CanvasNode[] {
  let out = nodes
  for (const g of nodes) if (g.type === 'area' && !g.data.collapsed) out = fitGroup(out, g.id)

  const top = out.filter((n) => !n.parentId && !n.hidden && isPlaced(n))
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

// Nota que passa da borda de cima ou da esquerda do bloco dela: tudo anda o tanto que ela passa,
// para o conjunto começar no respiro da borda. Sem isso, o ajuste ao conteúdo puxaria o grupo
// até a nota, e ele andaria um pouco a cada "Organizar grupo".
function startAt(origin: XYPosition, deltas: Map<string, XYPosition>, boxes: Map<string, Box>): Map<string, XYPosition> {
  let minX = Infinity
  let minY = Infinity
  for (const [id, d] of deltas) {
    const b = boxes.get(id)!
    minX = Math.min(minX, b.x + d.x)
    minY = Math.min(minY, b.y + d.y)
  }
  const dx = Math.max(0, origin.x - minX)
  const dy = Math.max(0, origin.y - minY)
  if (dx < STILL && dy < STILL) return deltas
  return new Map([...deltas].map(([id, d]) => [id, { x: d.x + dx, y: d.y + dy }]))
}

// "Organizar grupo": o mesmo, com os blocos de dentro do grupo, a partir do canto dele. O grupo
// encolhe (ou cresce) para caber, sem sair do lugar, e empurra os vizinhos se crescer.
export function organizeGroup(nodes: CanvasNode[], groupId: string, aspect = 16 / 10): CanvasNode[] {
  const group = nodes.find((n) => n.id === groupId)
  const children = childrenOf(nodes, groupId).filter(isPlaced)
  if (group?.type !== 'area' || group.data.collapsed || !children.length) return nodes
  const boxes = new Map(children.map((n) => [n.id, boxOf(n)]))
  const { blocks, riders } = splitRiders(children, boxes)
  const origin = { x: FIT_PADDING.side, y: FIT_PADDING.top }
  const deltas = arrangeInRows([blocks.sort(readingOrder(boxes))], boxes, riders, origin, GROUP_GAP, aspect)
  return fitGroupToContent(shift(nodes, startAt(origin, deltas, boxes)), groupId)
}
