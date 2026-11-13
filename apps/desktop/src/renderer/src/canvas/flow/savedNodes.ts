import type { CanvasNode } from '../types'

// Tipos de bloco que o canvas desenha hoje.
const TYPES = new Set(['area', 'project', 'terminal', 'chat', 'chatPanel', 'note'])
// "conversation", "browser" e "design" (o card do design livre) foram testes que não ficaram: não
// voltam para a tela e não contam como bloco estragado.
const RETIRED = new Set(['conversation', 'browser', 'design'])

type Raw = Record<string, unknown>

const isRecord = (value: unknown): value is Raw =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isPoint = (value: unknown) => isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y)

// O mínimo para o React Flow e o componente do bloco desenharem sem derrubar a janela: sem
// posição o React Flow quebra, e sem `data` quebra o componente.
function isNode(value: unknown): value is CanvasNode {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    TYPES.has(value.type) &&
    isPoint(value.position) &&
    isRecord(value.data) &&
    (value.parentId === undefined || typeof value.parentId === 'string')
  )
}

// As primeiras notas tinham tamanho fixo; hoje o balão acompanha o texto.
function upgrade(node: CanvasNode): CanvasNode {
  return node.type === 'note' && node.style ? { ...node, style: undefined, width: undefined, height: undefined } : node
}

// Canvas salvo (canvas.json, ou o que outra janela mandou) de volta à tela. Um bloco estragado não
// pode deixar a janela em branco: o que o React Flow não desenha fica de fora, junto com o que
// estava num grupo que sumiu. O grupo vem antes dos filhos, como o React Flow exige.
// `dropped`: quantos blocos estragados ficaram de fora (os testes antigos não contam).
export function nodesFromSaved(saved: unknown): { nodes: CanvasNode[]; dropped: number } {
  if (!Array.isArray(saved)) return { nodes: [], dropped: 0 }
  const valid: CanvasNode[] = []
  const ids = new Set<string>()
  let dropped = 0
  for (const item of saved) {
    if (isRecord(item) && typeof item.type === 'string' && RETIRED.has(item.type)) continue
    // Id repetido: fica o primeiro, senão o React Flow mistura os dois.
    if (!isNode(item) || ids.has(item.id)) {
      dropped++
      continue
    }
    ids.add(item.id)
    valid.push(upgrade(item))
  }

  const groups = new Set(valid.filter((n) => n.type === 'area').map((n) => n.id))
  const nodes: CanvasNode[] = []
  const placed = new Set<string>()
  // Filho que apareceu antes do grupo espera por ele.
  const waiting = new Map<string, CanvasNode[]>()
  const place = (node: CanvasNode) => {
    nodes.push(node)
    placed.add(node.id)
    const children = waiting.get(node.id)
    waiting.delete(node.id)
    children?.forEach(place)
  }
  for (const node of valid) {
    if (node.parentId && !groups.has(node.parentId)) dropped++
    else if (!node.parentId || placed.has(node.parentId)) place(node)
    else waiting.set(node.parentId, [...(waiting.get(node.parentId) ?? []), node])
  }
  // Sobrou esperando: grupos um dentro do outro, em ciclo, que nunca entram.
  for (const children of waiting.values()) dropped += children.length
  return { nodes, dropped }
}
