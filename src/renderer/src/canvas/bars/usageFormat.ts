// Textos e cores dos limites do Claude (barra de título).

// Quanto falta para a janela de uso recomeçar: "menos de 1min", "45min", "2h 15min", "3d 4h".
export function timeLeft(resetsAt: string, now: number): string {
  const min = Math.max(0, Math.round((new Date(resetsAt).getTime() - now) / 60_000))
  if (!Number.isFinite(min)) return ''
  if (min < 1) return 'menos de 1min'
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  if (d > 0) return h === 0 ? `${d}d` : `${d}d ${h}h`
  if (h === 0) return `${m}min`
  return m === 0 ? `${h}h` : `${h}h ${m}min`
}

// Quando recomeça: "hoje às 14:30" ou "sex 12/09 às 09:00". `now` decide o que é hoje.
export function resetLabel(resetsAt: string, now: number): string {
  const date = new Date(resetsAt)
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === new Date(now).toDateString()) return `hoje às ${time}`
  const day = date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
  return `${day.replace('.', '')} às ${time}`
}

export function barColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500'
  if (percent >= 75) return 'bg-needs-you'
  return 'bg-muted'
}
