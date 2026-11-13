import { hiddenWorktrees } from '../operations'
import type { CanvasNode } from '../types'

// Cópia de cada nó para a tela. O nó é imutável (mudar cria outro objeto), então a cópia de um nó
// que não mudou é a mesma: o React Flow não redesenha todas as instâncias a cada quadro de um
// arraste. Fica fora do componente, como um memo por nó.
const copies = new WeakMap<CanvasNode, { obscured: boolean; node: CanvasNode }>()

// Só na tela, não vai para o estado salvo:
// - instâncias de grupo com o conteúdo oculto somem; o grupo mostra listras no lugar;
// - instância de grupo arrastada contra a borda passa dela em vez de travar (expandParent),
//   e o grupo cresce até ela em onNodesChange;
// - tarefa isolada de uma pasta recolhida some junto (operations/worktrees.ts).
export function displayNodes(nodes: CanvasNode[]): CanvasNode[] {
  const obscured = new Set(nodes.filter((n) => n.type === 'area' && n.data.obscured).map((n) => n.id))
  const folded = hiddenWorktrees(nodes)
  return nodes.map((n) => {
    if (!n.parentId && !folded.has(n.id)) return n
    const hide = (!!n.parentId && obscured.has(n.parentId)) || folded.has(n.id)
    const cached = copies.get(n)
    if (cached?.obscured === hide) return cached.node
    const base: CanvasNode = n.parentId ? { ...n, expandParent: true } : { ...n }
    const node: CanvasNode = hide ? { ...base, hidden: true } : base
    copies.set(n, { obscured: hide, node })
    return node
  })
}
