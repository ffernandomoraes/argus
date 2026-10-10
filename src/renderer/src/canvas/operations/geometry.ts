import { AREA_OUTSET, CHAT_SIZE, INSTANCE_MIN_HEIGHT, INSTANCE_WIDTH, NOTE_SIZE, PROJECT_OUTSET } from '../factory'
import type { CanvasNode } from '../types'

// Medidas dos blocos: o tamanho de cada um, a caixa que ele ocupa na tela e quando duas caixas
// encostam. Base de todo o resto das operações.

// Respiro mínimo entre dois blocos.
export const GAP = 24

// Margens internas do grupo. O nome fica fora, acima da borda.
export const FIT_PADDING = { top: 24, side: 24, bottom: 24 }

export const COLLAPSED_SIZE = { width: 280, height: 40 }

// Deslocamento menor que isso não muda nada na tela: é sobra de conta com frações de pixel.
// Abaixo dele, a operação devolve a mesma lista, e o ⌘Z não ganha um passo vazio.
export const STILL = 0.01

export type Box = { x: number; y: number; width: number; height: number }

export const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width + GAP && b.x < a.x + a.width + GAP && a.y < b.y + b.height + GAP && b.y < a.y + a.height + GAP

// Bloco com posição de verdade. Um salvo sem ela (arquivo estragado) fica de fora das contas de
// lugar e não é mexido, em vez de derrubar a operação inteira.
export const isPlaced = (n: CanvasNode) => Number.isFinite(n.position?.x) && Number.isFinite(n.position?.y)

// Medida do estilo: número, ou texto como "620px" (arquivo editado à mão).
const styleSize = (value: unknown, fallback: number) => {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  return Number.isFinite(n) ? n : fallback
}

export function sizeOf(node: CanvasNode): { width: number; height: number } {
  // Instância recém-criada ainda não foi medida pelo React Flow.
  if (node.type === 'project' && !node.measured?.height) {
    return { width: INSTANCE_WIDTH, height: INSTANCE_MIN_HEIGHT }
  }
  if (node.type === 'chat' && !node.measured?.height) return { ...CHAT_SIZE }
  if (node.type === 'note' && !node.measured?.height) return { ...NOTE_SIZE }
  return {
    width: node.width ?? node.measured?.width ?? styleSize(node.style?.width, 480),
    height: node.height ?? node.measured?.height ?? styleSize(node.style?.height, 320)
  }
}

// Caixa que o nó ocupa na tela, contando o que ele desenha fora de si (PROJECT_OUTSET, AREA_OUTSET).
export function boxOf(node: CanvasNode): Box {
  const { width, height } = sizeOf(node)
  const out = node.type === 'project' ? PROJECT_OUTSET : node.type === 'area' ? AREA_OUTSET : { left: 0, top: 0 }
  return {
    x: node.position.x - out.left,
    y: node.position.y - out.top,
    width: width + out.left,
    height: height + out.top
  }
}

// Caixa que cobre os blocos (de fora de grupo), com os nomes acima deles. Calculada do estado,
// e não do que está na tela: logo depois de organizar, os blocos ainda estão indo para o lugar.
// Sem bloco, uma caixa vazia na origem (e não NaN).
export function boundsOf(nodes: CanvasNode[]): Box {
  const boxes = nodes.filter(isPlaced).map(boxOf)
  if (!boxes.length) return { x: 0, y: 0, width: 0, height: 0 }
  const x = Math.min(...boxes.map((b) => b.x))
  const y = Math.min(...boxes.map((b) => b.y))
  const right = Math.max(...boxes.map((b) => b.x + b.width))
  const bottom = Math.max(...boxes.map((b) => b.y + b.height))
  return { x, y, width: right - x, height: bottom - y }
}
