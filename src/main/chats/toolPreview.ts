// O pedido da ferramenta chega como JSON incompleto: tira dele os campos de texto que já
// fecharam (caminho, comando, descrição...) para mostrar o alvo antes de o pedido terminar.

// O caminho e o comando vêm no começo; o resto (conteúdo de arquivo) não muda o resumo.
export const TOOL_INPUT_SCAN = 4000

export function closedFields(json: string): Record<string, string> {
  const input: Record<string, string> = {}
  for (const [, key, value] of json.matchAll(/"(\w+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) {
    if (!(key in input)) input[key] = unescapeJson(value)
  }
  return input
}

function unescapeJson(s: string): string {
  try {
    return JSON.parse(`"${s}"`)
  } catch {
    return s
  }
}
