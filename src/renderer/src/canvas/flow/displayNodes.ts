import type { CanvasNode } from '../types'

// Cópia de cada nó para a tela. O nó é imutável (mudar cria outro objeto), então a cópia de um nó
// que não mudou é a mesma: o React Flow não redesenha todas as instâncias a cada quadro de um
// arraste. Fica fora do componente, como um memo por nó.
const copies = new WeakMap<CanvasNode, { obscured: boolean; node: CanvasNode }>()

// Só na tela, não vai para o estado salvo:
// - instâncias de grupo com o conteúdo oculto somem; o grupo mostra listras no lugar;
// - instância de grupo arrastada contra a borda passa dela em vez de travar (expandParent),
//   e o grupo cresce até ela em onNodesChange.
export function displayNodes(nodes: CanvasNode[]): CanvasNode[] {
  const obscured = new Set(nodes.filter((n) => n.type === 'area' && n.data.obscured).map((n) => n.id))
  return nodes.map((n) => {
    if (!n.parentId) return n
    const hide = obscured.has(n.parentId)
    const cached = copies.get(n)
    if (cached?.obscured === hide) return cached.node
    const node: CanvasNode = hide ? { ...n, expandParent: true, hidden: true } : { ...n, expandParent: true }
    copies.set(n, { obscured: hide, node })
    return node
  })
}
