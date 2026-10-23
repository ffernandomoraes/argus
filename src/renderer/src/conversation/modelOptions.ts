import type { ClaudeModel } from '../../../shared/models'
import { tr } from '../i18n'

// Níveis de esforço do --effort, com os nomes da extensão do VS Code, traduzidos.
export const EFFORTS = [
  { value: 'low', label: tr('Baixo', 'Low') },
  { value: 'medium', label: tr('Médio', 'Medium') },
  { value: 'high', label: tr('Alto', 'High') },
  { value: 'xhigh', label: tr('Muito alto', 'Extra high') },
  { value: 'max', label: tr('Máximo', 'Max') }
]

export const effortLabel = (value: string) => EFFORTS.find((e) => e.value === value)?.label ?? 'Auto'

// "Opus 5.5" → família "Opus". A ordem das famílias segue a ordem da lista do claude.
// Família de um nome: "Opus 4.7" -> "Opus". Nomes sem espaço (Codex, Cursor: "gpt-5.6-sol",
// "claude-opus-5-5") vão até o primeiro pedaço que começa com número: "GPT", "Claude Opus".
export function familyOf(name: string): string {
  if (name.includes(' ')) return name.split(' ')[0]
  const words: string[] = []
  for (const part of name.split('-')) {
    if (/^\d/.test(part)) break
    words.push(part.length <= 3 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1))
  }
  return words.join(' ') || name
}

export function groupByFamily(models: ClaudeModel[]) {
  const families = new Map<string, ClaudeModel[]>()
  for (const m of models) {
    if (m.value === '') continue
    const family = familyOf(m.displayName)
    families.set(family, [...(families.get(family) ?? []), m])
  }
  return [...families.entries()]
}
