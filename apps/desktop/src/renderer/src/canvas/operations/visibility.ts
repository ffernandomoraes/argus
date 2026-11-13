import { GROUP_SIZE } from '../factory'
import type { CanvasNode } from '../types'
import { COLLAPSED_SIZE, sizeOf } from './geometry'
import { pushAway } from './push'

// Mostrar e esconder: grupo recolhido ou com o conteúdo oculto, pasta recolhida. O que some da
// tela deixa de estar selecionado: senão o ⌫ apagaria uma nota que ninguém está vendo.

// Recolhido: o grupo vira só a barra de título e as instâncias de dentro ficam escondidas.
export function toggleCollapse(nodes: CanvasNode[], id: string): CanvasNode[] {
  const group = nodes.find((n) => n.id === id)
  if (!group || group.type !== 'area') return nodes
  const collapse = !group.data.collapsed
  const size = collapse ? COLLAPSED_SIZE : (group.data.expandedSize ?? GROUP_SIZE)

  const next = nodes.map((n) => {
    if (n.parentId === id) return { ...n, hidden: collapse, ...(collapse && n.selected && { selected: false }) }
    if (n.id !== id || n.type !== 'area') return n
    return {
      ...n,
      ...size,
      selected: false,
      style: { ...n.style, ...size },
      data: {
        ...n.data,
        collapsed: collapse,
        expandedSize: collapse ? sizeOf(n) : n.data.expandedSize
      }
    }
  })
  // Ao abrir, o grupo volta ao tamanho cheio e pode ter ganhado vizinho no espaço livre.
  return collapse ? next : pushAway(next, [id])
}

// Conteúdo oculto: as instâncias continuam no lugar, só não aparecem.
export function toggleObscure(nodes: CanvasNode[], id: string): CanvasNode[] {
  const group = nodes.find((n) => n.id === id)
  const hiding = group?.type === 'area' && !group.data.obscured
  return nodes.map((n) => {
    if (n.id === id && n.type === 'area') return { ...n, data: { ...n.data, obscured: !n.data.obscured } }
    if (hiding && n.parentId === id && n.selected) return { ...n, selected: false }
    return n
  })
}

// Pasta recolhida: a lista de conversas encolhe para as que pedem atenção.
export function toggleProjectCollapse(nodes: CanvasNode[], id: string): CanvasNode[] {
  return nodes.map((n) =>
    n.id === id && n.type === 'project' ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } } : n
  )
}
