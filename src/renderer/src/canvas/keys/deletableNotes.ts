import type { CanvasNode } from '../types'

// Notas que o Delete apaga: as selecionadas que estão à vista. Recolher ou ocultar o grupo não
// tira a seleção dos filhos, e apagar uma nota que não aparece seria perda sem sinal.
export function deletableNotes(nodes: CanvasNode[]): Set<string> {
  const obscured = new Set(nodes.filter((n) => n.type === 'area' && n.data.obscured).map((n) => n.id))
  return new Set(
    nodes
      .filter((n) => n.type === 'note' && n.selected && !n.hidden && !(n.parentId && obscured.has(n.parentId)))
      .map((n) => n.id)
  )
}
