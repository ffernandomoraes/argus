import type { XYPosition } from '@xyflow/react'
import { PROJECT_OUTSET } from '../factory'
import { FIT_PADDING, fitGroupToContent, growGroupsToFit, sizeOf } from '../operations'
import type { CanvasNode } from '../types'
import { findBlock, num } from './lookup'
import { ToolError, type Tool } from './tool'

// Mexer na posição dos blocos e na câmera.

// Espaço entre blocos na grade. Dentro de um grupo, a grade começa no respiro da borda dele.
const GAP = 40

// O que o bloco desenha acima de si (botões da pasta); conta como espaço ocupado.
const outsetTop = (n: CanvasNode) => (n.type === 'project' ? PROJECT_OUTSET.top : 0)

const mover: Tool = (args, env) => {
  const items = (args.itens as { id: string; x: number; y: number }[]) ?? []
  let next = env.nodes()
  const moved: string[] = []
  for (const item of items) {
    const node = findBlock(next, item.id)
    const parent = node.parentId ? next.find((g) => g.id === node.parentId) : undefined
    const position = parent ? { x: item.x - parent.position.x, y: item.y - parent.position.y } : { x: item.x, y: item.y }
    next = next.map((n) => (n.id === node.id ? ({ ...n, position } as CanvasNode) : n))
    moved.push(node.id)
  }
  env.apply(growGroupsToFit(next, moved))
  return `${moved.length} bloco(s) movido(s).`
}

const organizarEmGrade: Tool = (args, env) => {
  const nodes = env.nodes()
  const list = ((args.ids as string[]) ?? []).map((ref) => findBlock(nodes, ref))
  const parentId = list[0]?.parentId
  if (list.some((n) => n.parentId !== parentId)) throw new ToolError('Os blocos precisam estar no mesmo grupo, ou todos soltos.')
  const cols = num(args.colunas) ?? list.length
  const first = list[0]
  // Trabalha com a caixa visível (pasta conta os botões de cima).
  const start = parentId
    ? { x: FIT_PADDING.side, y: FIT_PADDING.top }
    : { x: num(args.x) ?? first.position.x, y: num(args.y) ?? first.position.y - outsetTop(first) }
  const positions = new Map<string, XYPosition>()
  let y = start.y
  for (let row = 0; row * cols < list.length; row++) {
    const items = list.slice(row * cols, row * cols + cols)
    let x = start.x
    let rowHeight = 0
    for (const n of items) {
      const s = sizeOf(n)
      positions.set(n.id, { x, y: y + outsetTop(n) })
      x += s.width + GAP
      rowHeight = Math.max(rowHeight, s.height + outsetTop(n))
    }
    y += rowHeight + GAP
  }
  let next = nodes.map((n) => (positions.has(n.id) ? ({ ...n, position: positions.get(n.id)! } as CanvasNode) : n))
  if (parentId) next = fitGroupToContent(next, parentId)
  env.apply(next)
  return `${list.length} bloco(s) organizados em ${Math.ceil(list.length / cols)} linha(s).`
}

const focar: Tool = (args, env) => {
  const ids = ((args.ids as string[]) ?? []).map((ref) => findBlock(env.nodes(), ref).id)
  env.frame(ids)
  return 'Visão ajustada.'
}

export const layoutTools: Record<string, Tool> = { mover, organizar_em_grade: organizarEmGrade, focar }
