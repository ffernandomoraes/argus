import type { ClaudeModel } from '../../../shared/models'

// Níveis de esforço do --effort, com os nomes da extensão do VS Code, traduzidos.
export const EFFORTS = [
  { value: 'low', label: 'Baixo' },
  { value: 'medium', label: 'Médio' },
  { value: 'high', label: 'Alto' },
  { value: 'xhigh', label: 'Muito alto' },
  { value: 'max', label: 'Máximo' }
]

// Texto da extensão do VS Code para o nível máximo, traduzido.
export const MAX_WARNING =
  'Pode gastar tokens demais, com respostas lentas ou pensamento excessivo. Use só nas tarefas mais difíceis.'

export const effortLabel = (value: string) => EFFORTS.find((e) => e.value === value)?.label ?? 'Auto'

// "Opus 5.5" → família "Opus". A ordem das famílias segue a ordem da lista do claude.
export function groupByFamily(models: ClaudeModel[]) {
  const families = new Map<string, ClaudeModel[]>()
  for (const m of models) {
    if (m.value === '') continue
    const family = m.displayName.split(' ')[0]
    families.set(family, [...(families.get(family) ?? []), m])
  }
  return [...families.entries()]
}
