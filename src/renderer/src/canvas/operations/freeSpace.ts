import type { XYPosition } from '@xyflow/react'
import { CHAT_SIZE } from '../factory'
import type { CanvasNode } from '../types'
import { boxOf, FIT_PADDING, GAP, isPlaced, overlaps, type Box } from './geometry'

// Onde cabe um bloco sem encostar nos outros.

// Desce a caixa até ela não encostar em nenhuma das ocupadas; devolve o y em que ficou livre.
export function freeY(box: Box, occupied: Box[]): number {
  const probe = { ...box }
  for (let b = occupied.find((o) => overlaps(probe, o)); b; b = occupied.find((o) => overlaps(probe, o))) {
    probe.y = b.y + b.height + GAP
  }
  return probe.y
}

// Primeiro lugar livre ao lado ou embaixo das instâncias que já estão no grupo.
// Prefere o que cabe sem aumentar o grupo; depois, o mais acima e mais à esquerda.
export function findFreeSpot(occupied: Box[], size: { width: number; height: number }, groupWidth: number) {
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

// Posição do nó descida até a caixa dele não encostar em nenhum bloco solto.
export function freeSpot(nodes: CanvasNode[], node: CanvasNode): XYPosition {
  const occupied = nodes.filter((n) => !n.parentId && !n.hidden && isPlaced(n)).map(boxOf)
  const box = boxOf(node)
  return { x: node.position.x, y: node.position.y + freeY(box, occupied) - box.y }
}

// Onde entra a conversa solta nova. Clique com o botão direito num lugar livre vale como
// pedido de posição. Senão: embaixo da última conversa solta ou, se for a primeira, à direita
// do último grupo criado, alinhada pelo topo. Se encostar em algum bloco, desce até ficar livre.
export function findChatSpot(nodes: CanvasNode[], requested?: XYPosition): XYPosition {
  const top = nodes.filter((n) => !n.parentId && isPlaced(n))
  const occupied = top.map(boxOf)
  const hit = (p: XYPosition) => occupied.find((b) => overlaps({ ...p, ...CHAT_SIZE }, b))
  if (requested && !hit(requested)) return requested

  const lastChat = [...top].reverse().find((n) => n.type === 'chat')
  // Grupo novo entra no início da lista (para ficar atrás dos blocos): o primeiro é o mais recente.
  const anchor = lastChat ?? top.find((n) => n.type === 'area') ?? top.at(-1)
  if (!anchor) return requested ?? { x: 0, y: 0 }
  const a = boxOf(anchor)
  const spot = lastChat ? { x: a.x, y: a.y + a.height + GAP } : { x: a.x + a.width + GAP, y: a.y }
  return { x: spot.x, y: freeY({ ...spot, ...CHAT_SIZE }, occupied) }
}
