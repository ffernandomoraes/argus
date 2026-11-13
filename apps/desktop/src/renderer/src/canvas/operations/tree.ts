import type { XYPosition } from '@xyflow/react'
import type { CanvasNode } from '../types'
import { isPlaced } from './geometry'

// Quem está dentro de quem. O bloco de dentro de um grupo guarda a posição relativa ao grupo
// (parentId); fora dele, a do canvas.

export function childrenOf(nodes: CanvasNode[], groupId: string): CanvasNode[] {
  return nodes.filter((n) => n.parentId === groupId)
}

// Posição relativa ao grupo somada à do grupo. Sem posição de um dos dois, fica a que o bloco tem.
const offsetBy = (parent: CanvasNode, node: CanvasNode): XYPosition =>
  isPlaced(parent) && isPlaced(node)
    ? { x: parent.position.x + node.position.x, y: parent.position.y + node.position.y }
    : node.position

// Posição no canvas: somada a do grupo, se o bloco estiver num.
export function absolutePosition(nodes: CanvasNode[], node: CanvasNode): XYPosition {
  const parent = node.parentId ? nodes.find((p) => p.id === node.parentId) : undefined
  return parent ? offsetBy(parent, node) : node.position
}

// O bloco sai do grupo sem mudar de lugar na tela.
export function detach(node: CanvasNode, parent: CanvasNode): CanvasNode {
  const { parentId: _p, extent: _e, ...rest } = node
  return { ...rest, hidden: false, position: offsetBy(parent, node) } as CanvasNode
}
