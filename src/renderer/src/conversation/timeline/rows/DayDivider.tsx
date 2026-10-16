import { memo } from 'react'
import { LOCALE, tr } from '../../../i18n'

const DAY_MS = 86_400_000
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

// "Hoje", "Ontem" ou a data por extenso ("quinta-feira, 15 de outubro"); o ano só quando não é o atual.
export function dayLabel(at: string, now = new Date()): string {
  const d = new Date(at)
  // round: o dia da troca do horário de verão tem 23 ou 25 horas.
  const days = Math.round((startOfDay(now) - startOfDay(d)) / DAY_MS)
  if (days === 0) return tr('Hoje', 'Today')
  if (days === 1) return tr('Ontem', 'Yesterday')
  return d.toLocaleDateString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(d.getFullYear() !== now.getFullYear() && { year: 'numeric' })
  })
}

// Mesma chave para a mesma data local: a divisória de um dia é uma só.
export const dayKey = (at: string) => {
  const d = new Date(at)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

// Divisor de dia: a conversa continuou em outro dia. Mesmo desenho do EventDivider.
export const DayDivider = memo(function DayDivider({ at }: { at: string }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[13px] text-faint">
      <span className="h-px flex-1 bg-line" />
      <span className="shrink-0">{dayLabel(at)}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
})
