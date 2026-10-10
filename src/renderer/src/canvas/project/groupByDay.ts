import type { ConversationSummary } from '../types'

export type DayGroup = { key: string; label: string | null; items: ConversationSummary[] }

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

// Agrupa por dia (local), na ordem da lista. As de hoje ficam no topo sem título; as mais antigas
// ganham a data ("19/10", ou "19/10/2025" se for de outro ano).
export function groupByDay(conversations: ConversationSummary[], now: number): DayGroup[] {
  const today = new Date(now)
  const groups: DayGroup[] = []
  for (const c of conversations) {
    const d = new Date(c.updatedAt)
    const key = dayKey(d)
    let group = groups[groups.length - 1]
    if (group?.key !== key) {
      const label =
        key === dayKey(today)
          ? null
          : d.toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              ...(d.getFullYear() !== today.getFullYear() && { year: 'numeric' })
            })
      group = { key, label, items: [] }
      groups.push(group)
    }
    group.items.push(c)
  }
  return groups
}
