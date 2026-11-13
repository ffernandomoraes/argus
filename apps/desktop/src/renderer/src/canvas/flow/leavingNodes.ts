import type { CanvasNode } from '../types'

// Blocos apagados que ainda estão sumindo na tela, pelo id.
export type Leaving = ReadonlyMap<string, CanvasNode>

export const NO_LEAVING: Leaving = new Map()

// O bloco que saiu da lista continua na tela, sem clique nem arraste, até o fade terminar.
// Voltou antes disso (desfazer): sai da lista de saída e fica normal. Sem mudança, a mesma lista.
export function withLeaving(before: CanvasNode[], after: CanvasNode[], leaving: Leaving): Leaving {
  const ids = new Set(after.map((n) => n.id))
  let next: Map<string, CanvasNode> | null = null
  for (const n of before) {
    if (ids.has(n.id) || leaving.has(n.id)) continue
    next ??= new Map(leaving)
    next.set(n.id, {
      ...n,
      className: `${n.className ?? ''} node-leaving`,
      selected: false,
      draggable: false,
      selectable: false,
      connectable: false
    })
  }
  for (const id of leaving.keys()) {
    if (!ids.has(id)) continue
    next ??= new Map(leaving)
    next.delete(id)
  }
  return next ?? leaving
}

// Mesmos nós, na mesma ordem (cada nó é imutável: mudar cria outro objeto).
export function sameNodes(a: readonly CanvasNode[], b: readonly CanvasNode[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i])
}

// Os que terminaram de sumir saem da lista.
export function withoutLeaving(leaving: Leaving, done: readonly string[]): Leaving {
  if (!done.some((id) => leaving.has(id))) return leaving
  const next = new Map(leaving)
  for (const id of done) next.delete(id)
  return next
}
