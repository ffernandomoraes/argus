import { toggleCollapse, toggleObscure } from '../operations'
import type { CanvasNode } from '../types'

// Grupo que esconde o bloco: recolhido (o bloco fica `hidden`) ou com o conteúdo oculto.
export function hidingGroup(nodes: CanvasNode[], id: string): string | null {
  const node = nodes.find((n) => n.id === id)
  const group = node?.parentId ? nodes.find((n) => n.id === node.parentId) : undefined
  return group?.type === 'area' && (group.data.collapsed || group.data.obscured) ? group.id : null
}

// O fitView do React Flow ignora bloco escondido: antes de ir até ele, o grupo dele abre e mostra
// o conteúdo. Nada escondendo, a mesma lista.
export function revealNode(nodes: CanvasNode[], id: string): CanvasNode[] {
  const groupId = hidingGroup(nodes, id)
  const group = groupId ? nodes.find((n) => n.id === groupId) : undefined
  if (group?.type !== 'area') return nodes
  let out = nodes
  if (group.data.collapsed) out = toggleCollapse(out, group.id)
  if (group.data.obscured) out = toggleObscure(out, group.id)
  return out
}
