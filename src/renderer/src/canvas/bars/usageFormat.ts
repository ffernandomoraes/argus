import { LOCALE, tr } from '../../i18n'

// Textos e cores dos limites do Claude (barra de título).

// Quanto falta para a janela de uso recomeçar: "menos de 1min", "45min", "2h 15min", "3d 4h".
export function timeLeft(resetsAt: string, now: number): string {
  const min = Math.max(0, Math.round((new Date(resetsAt).getTime() - now) / 60_000))
  if (!Number.isFinite(min)) return ''
  if (min < 1) return tr('menos de 1min', 'less than 1m')
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  const mins = tr(`${m}min`, `${m}m`)
  if (d > 0) return h === 0 ? `${d}d` : `${d}d ${h}h`
  if (h === 0) return mins
  return m === 0 ? `${h}h` : `${h}h ${mins}`
}

// Quando recomeça: "hoje às 14:30" ou "sex 12/09 às 09:00". `now` decide o que é hoje.
export function resetLabel(resetsAt: string, now: number): string {
  const date = new Date(resetsAt)
  const time = date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
  if (date.toDateString() === new Date(now).toDateString()) return tr(`hoje às ${time}`, `today at ${time}`)
  const day = date.toLocaleDateString(LOCALE, { weekday: 'short', day: '2-digit', month: '2-digit' })
  return tr(`${day.replace('.', '')} às ${time}`, `${day} at ${time}`)
}

// Nome de uma janela pela duração que o agente informa (Codex): "Sessão (5 horas)", como a do
// Claude; "Semanal"; "30 dias" (plano free). Sem duração, só "Limite".
export function windowTitle(minutes?: number): string {
  if (!minutes || minutes <= 0) return tr('Limite', 'Limit')
  if (minutes === 10_080) return tr('Semanal', 'Weekly')
  if (minutes === 1440) return tr('Diário', 'Daily')
  if (minutes >= 1440) {
    const d = Math.round(minutes / 1440)
    return tr(`${d} dias`, `${d} days`)
  }
  if (minutes < 60) return tr(`Sessão (${minutes} min)`, `Session (${minutes} min)`)
  const h = Math.round(minutes / 60)
  return h === 1 ? tr('Sessão (1 hora)', 'Session (1 hour)') : tr(`Sessão (${h} horas)`, `Session (${h} hours)`)
}

export function barColor(percent: number): string {
  if (percent >= 90) return 'bg-red-500'
  if (percent >= 75) return 'bg-needs-you'
  return 'bg-muted'
}
