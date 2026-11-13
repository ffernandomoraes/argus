import type { XYPosition } from '@xyflow/react'
import type { CanvasNode } from '../types'
import { boxOf, GAP, isPlaced, overlaps, type Box } from './geometry'

// Bloco que cresceu (grupo, pasta, terminal) não fica por cima de outro: quem encosta é
// empurrado para longe, pelo lado em que precisa andar menos, e empurra os seguintes. Vale entre
// blocos soltos e entre irmãos do mesmo grupo (pasta que abriu um subagente empurra a de baixo;
// quem chama faz o grupo crescer depois). Os blocos de `ids` ficam parados.
export function pushAway(nodes: CanvasNode[], ids: string[]): CanvasNode[] {
  const deltas = new Map<string, XYPosition>()
  const scopes = new Set(ids.map((id) => nodes.find((n) => n.id === id)?.parentId))
  for (const scope of scopes) pushInScope(nodes, ids, scope, deltas)
  if (!deltas.size) return nodes
  return nodes.map((n) => {
    const d = deltas.get(n.id)
    return d ? ({ ...n, position: { x: n.position.x + d.x, y: n.position.y + d.y } } as CanvasNode) : n
  })
}

// Empurra só entre os blocos com o mesmo pai (`undefined` = soltos no canvas): as posições de
// irmãos estão no mesmo sistema de coordenadas.
function pushInScope(nodes: CanvasNode[], ids: string[], scope: string | undefined, deltas: Map<string, XYPosition>) {
  const boxes = new Map(
    nodes.filter((n) => n.parentId === scope && !n.hidden && isPlaced(n)).map((n) => [n.id, boxOf(n)])
  )
  const fixed = new Set(ids.filter((id) => boxes.has(id)))
  const queue = [...fixed]
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

// O contrário do empurrar: bloco que encolheu (subagente terminou, conversa saiu) puxa de volta
// para cima quem estava encostado logo abaixo dele (a GAP da borda de baixo antiga, que é onde o
// empurrão deixa), em cadeia. Quem foi posto mais longe de propósito fica onde está, e ninguém
// sobe por cima de outro bloco. `shrunk` leva o id e onde ficava a borda de baixo antes.
export function pullBack(nodes: CanvasNode[], shrunk: { id: string; oldBottom: number }[]): CanvasNode[] {
  const deltas = new Map<string, XYPosition>()
  const scopes = new Set(shrunk.map((s) => nodes.find((n) => n.id === s.id)?.parentId))
  for (const scope of scopes) pullInScope(nodes, shrunk, scope, deltas)
  if (!deltas.size) return nodes
  return nodes.map((n) => {
    const d = deltas.get(n.id)
    return d ? ({ ...n, position: { x: n.position.x + d.x, y: n.position.y + d.y } } as CanvasNode) : n
  })
}

// Encostado: a borda de cima do bloco está na GAP da borda de baixo antiga (sobra de fração de pixel não conta).
const TOUCHING = 1

const sideBySide = (a: Box, b: Box) => a.x < b.x + b.width + GAP && b.x < a.x + a.width + GAP

function pullInScope(
  nodes: CanvasNode[],
  shrunk: { id: string; oldBottom: number }[],
  scope: string | undefined,
  deltas: Map<string, XYPosition>
) {
  const boxes = new Map(
    nodes.filter((n) => n.parentId === scope && !n.hidden && isPlaced(n)).map((n) => [n.id, boxOf(n)])
  )
  const queue = shrunk.filter((s) => boxes.has(s.id))
  // Teto de segurança, como no empurrar.
  for (let guard = 0; queue.length && guard < 500; guard++) {
    const { id, oldBottom } = queue.shift()!
    const a = boxes.get(id)!
    const newBottom = a.y + a.height
    if (newBottom >= oldBottom - TOUCHING) continue
    for (const [otherId, b] of boxes) {
      if (b === a || !sideBySide(a, b) || Math.abs(b.y - (oldBottom + GAP)) > TOUCHING) continue
      // Sobe até encostar no bloco mais baixo que estiver acima dele, o que encolheu incluído.
      let target = newBottom + GAP
      for (const o of boxes.values()) {
        if (o !== b && o.y < b.y && o.y + o.height <= b.y && sideBySide(o, b)) target = Math.max(target, o.y + o.height + GAP)
      }
      const dy = target - b.y
      if (dy > -TOUCHING) continue
      const bottom = b.y + b.height
      b.y += dy
      const total = deltas.get(otherId) ?? { x: 0, y: 0 }
      deltas.set(otherId, { x: total.x, y: total.y + dy })
      queue.push({ id: otherId, oldBottom: bottom })
    }
  }
}
