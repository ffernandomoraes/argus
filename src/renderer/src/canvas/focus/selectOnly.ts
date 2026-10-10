import type { CanvasNode } from '../types'

// Só o bloco `id` selecionado. `selected` ausente vale falso (comparar `undefined` com `false`
// recriava todos os nós a cada seleção); sem mudança, a mesma lista e os mesmos objetos.
export function selectOnly(nodes: CanvasNode[], id: string): CanvasNode[] {
  let changed = false
  const next = nodes.map((n) => {
    const selected = n.id === id
    if (!!n.selected === selected) return n
    changed = true
    return { ...n, selected }
  })
  return changed ? next : nodes
}
