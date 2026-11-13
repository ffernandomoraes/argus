import type { CanvasNode } from '../types'

// Estado só desta janela: seleção, arraste e a medida que o React Flow tirou da tela. Não vai para
// o arquivo nem para as outras janelas: cada janela mede a sua, e a medida de outra (ou a de um ⌘Z,
// guardada antes) chegaria velha. Com ela, o grupo encolhia e a pasta vazava pela borda.
const LOCAL = new Set(['selected', 'dragging', 'resizing', 'measured'])

// O nó sem o que é desta janela, na mesma ordem de chaves (a comparação é pelo JSON).
export function sharedPart(node: CanvasNode): CanvasNode {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) if (!LOCAL.has(key)) out[key] = value
  return out as CanvasNode
}

// O que sai para o processo principal (arquivo, desfazer e as outras janelas).
export const forSync = (nodes: CanvasNode[]): CanvasNode[] => nodes.map(sharedPart)

const sameShared = (a: CanvasNode, b: CanvasNode) => JSON.stringify(sharedPart(a)) === JSON.stringify(sharedPart(b))

// Canvas que chegou de outra janela (ou do ⌘Z) entra mantendo o que é desta: a seleção e a medida.
// Bloco que não mudou fica com o mesmo objeto, para o React Flow não redesenhar a tela inteira a
// cada quadro de um arraste feito na outra janela; sem mudança nenhuma, volta a lista de antes.
export function mergeRemote(local: CanvasNode[], remote: CanvasNode[]): CanvasNode[] {
  const mine = new Map(local.map((n) => [n.id, n]))
  let unchanged = local.length === remote.length
  const next = remote.map((theirs, i) => {
    const own = mine.get(theirs.id)
    if (own && sameShared(own, theirs)) {
      if (local[i] !== own) unchanged = false
      return own
    }
    unchanged = false
    if (!own) return theirs
    return {
      ...theirs,
      ...(own.selected && { selected: true }),
      ...(own.measured && { measured: own.measured })
    } as CanvasNode
  })
  return unchanged ? local : next
}
