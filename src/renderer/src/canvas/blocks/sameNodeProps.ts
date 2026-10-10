// Props que o React Flow manda de novo a cada quadro de arraste (posição na tela, camada,
// "arrastando") e que nenhum bloco usa: mudar só elas não redesenha o conteúdo do bloco.
const IGNORED = new Set(['positionAbsoluteX', 'positionAbsoluteY', 'zIndex', 'dragging'])

// Comparação para o `memo` dos nós do canvas: iguais quando todas as outras props (id, data,
// selected, parentId, width, height...) são as mesmas. Comparar todas, e não uma lista fixa,
// evita que um bloco que passe a usar outra prop fique sem atualizar.
export function sameNodeProps(a: object, b: object): boolean {
  const before = a as Record<string, unknown>
  const after = b as Record<string, unknown>
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (!IGNORED.has(key) && !Object.is(before[key], after[key])) return false
  }
  return true
}
