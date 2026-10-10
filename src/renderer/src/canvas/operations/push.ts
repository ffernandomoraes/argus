import type { XYPosition } from '@xyflow/react'
import type { CanvasNode } from '../types'
import { boxOf, GAP, isPlaced, overlaps, type Box } from './geometry'

// Bloco solto (grupo, pasta, terminal) que cresceu não fica por cima de outro: quem encosta
// é empurrado para longe, pelo lado em que precisa andar menos, e empurra os seguintes.
// Os blocos de `ids` ficam parados.
export function pushAway(nodes: CanvasNode[], ids: string[]): CanvasNode[] {
  const boxes = new Map(nodes.filter((n) => !n.parentId && !n.hidden && isPlaced(n)).map((n) => [n.id, boxOf(n)]))
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

// Menor deslocamento que tira `b` de cima de `a`, sempre para o lado em que `b` já está. O lado
// vem do canto de cima à esquerda, e não do centro: `a` pode ter acabado de crescer (grupo que
// abriu, pasta com conversa nova), e o centro dele passaria do bloco que estava logo abaixo,
// jogando esse bloco para cima e, em cadeia, um vizinho para dentro de quem cresceu.
function pushVector(a: Box, b: Box): XYPosition {
  const below = b.y >= a.y
  const right = b.x >= a.x
  const vertical = below ? a.y + a.height + GAP - b.y : a.y - GAP - (b.y + b.height)
  const horizontal = right ? a.x + a.width + GAP - b.x : a.x - GAP - (b.x + b.width)
  return Math.abs(vertical) <= Math.abs(horizontal) ? { x: 0, y: vertical } : { x: horizontal, y: 0 }
}
