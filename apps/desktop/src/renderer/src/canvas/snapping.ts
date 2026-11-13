import type { XYPosition } from '@xyflow/react'
import { isPlaced, sizeOf, type Box } from './operations'
import type { CanvasNode } from './types'

// Encaixe ao arrastar: o bloco alinha pela borda ou pelo meio com os vizinhos (mesmo grupo,
// ou soltos no canvas) quando chega perto, na horizontal e na vertical, e aparece a linha-guia.

// Distância, em pixels de tela, em que o encaixe pega.
const SNAP_DISTANCE = 8

// Linha-guia em coordenadas do canvas (já somada a posição do grupo, se houver).
// x: linha vertical em `at`, de `from` a `to` no eixo y. y: o contrário.
export type Guide = { axis: 'x' | 'y'; at: number; from: number; to: number }

// Começo, meio e fim do bloco num eixo.
const lines = (start: number, size: number) => [start, start + size / 2, start + size]

// Menor ajuste que alinha alguma linha do bloco com alguma linha de um vizinho.
function closest(mine: number[], theirs: number[][], limit: number): number | null {
  let best: number | null = null
  for (const others of theirs)
    for (const o of others)
      for (const m of mine) {
        const d = o - m
        if (Math.abs(d) <= limit && (best === null || Math.abs(d) < Math.abs(best))) best = d
      }
  return best
}

export function snap(
  nodes: CanvasNode[],
  id: string,
  position: XYPosition,
  zoom: number
): { position: XYPosition; guides: Guide[] } {
  const node = nodes.find((n) => n.id === id)
  if (!node) return { position, guides: [] }
  const { width, height } = sizeOf(node)
  const neighbors: Box[] = nodes
    .filter((n) => n.id !== id && !n.hidden && n.parentId === node.parentId && isPlaced(n))
    .map((n) => ({ ...n.position, ...sizeOf(n) }))
  if (neighbors.length === 0) return { position, guides: [] }

  const limit = SNAP_DISTANCE / zoom
  const dx = closest(lines(position.x, width), neighbors.map((b) => lines(b.x, b.width)), limit) ?? 0
  const dy = closest(lines(position.y, height), neighbors.map((b) => lines(b.y, b.height)), limit) ?? 0
  const snapped = { x: position.x + dx, y: position.y + dy }

  // Guias: cada linha do bloco que ficou alinhada, esticada até os vizinhos alinhados a ela.
  const parent = node.parentId ? nodes.find((n) => n.id === node.parentId)?.position : undefined
  const offset = parent ?? { x: 0, y: 0 }
  const guides: Guide[] = []
  const me: Box = { ...snapped, width, height }
  for (const axis of ['x', 'y'] as const) {
    const start = axis === 'x' ? 'x' : 'y'
    const size = axis === 'x' ? 'width' : 'height'
    const across = axis === 'x' ? 'y' : 'x'
    const acrossSize = axis === 'x' ? 'height' : 'width'
    for (const at of lines(me[start], me[size])) {
      const aligned = neighbors.filter((b) => lines(b[start], b[size]).some((l) => Math.abs(l - at) < 0.5))
      if (aligned.length === 0) continue
      const boxes = [me, ...aligned]
      guides.push({
        axis,
        at: at + offset[start],
        from: Math.min(...boxes.map((b) => b[across])) + offset[across],
        to: Math.max(...boxes.map((b) => b[across] + b[acrossSize])) + offset[across]
      })
    }
  }
  return { position: snapped, guides }
}
