import type { AreaNode, CanvasNode } from '../types'
import { ToolError } from './tool'

// Achar o bloco que o Claude citou e descrever um bloco para ele.

// Nota não tem nome: vale a primeira linha do texto.
export const nameOf = (n: CanvasNode) =>
  n.type === 'area' ? n.data.label : n.type === 'note' ? (n.data.text.split('\n')[0] ?? '') : n.data.name

const KIND = { area: 'grupo', project: 'pasta', terminal: 'terminal', chat: 'conversa', chatPanel: 'conversa aberta', note: 'nota' } as const
export const kindOf = (n: CanvasNode) => KIND[n.type]

export const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

// Aceita o id e, na falta dele, o nome: o modelo às vezes troca um pelo outro.
export function findBlock(nodes: CanvasNode[], ref: unknown): CanvasNode {
  const key = String(ref ?? '')
  const byId = nodes.find((n) => n.id === key)
  if (byId) return byId
  const byName = nodes.filter((n) => nameOf(n).toLowerCase() === key.toLowerCase())
  if (byName.length === 1) return byName[0]
  throw new ToolError(byName.length ? `Mais de um bloco chamado "${key}"; use o id.` : `Bloco "${key}" não existe.`)
}

export function findGroup(nodes: CanvasNode[], ref: unknown): AreaNode {
  const g = findBlock(nodes, ref)
  if (g.type !== 'area') throw new ToolError(`"${nameOf(g)}" não é um grupo.`)
  return g
}
