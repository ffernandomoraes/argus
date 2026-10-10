// Formatos de hora, duração e contagem que aparecem na conversa. Os formatadores do Intl são
// criados uma vez: montar um a cada chamada custava ~60 vezes mais, e a conversa formata a hora de
// cada mensagem.
const TIME = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const THOUSANDS = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

// "14:32" hoje; "06/10 14:32" em outro dia. Hora ilegível não vira "Invalid Date" (e o formatador
// lançaria erro com ela).
export function formatClock(iso: string | number): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const time = TIME.format(d)
  return d.toDateString() === new Date().toDateString() ? time : `${DAY.format(d)} ${time}`
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min ${String(s % 60).padStart(2, '0')}s`
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}min`
}

export function formatTokens(n: number): string {
  if (n < 1000) return `${n} tokens`
  return `${THOUSANDS.format(n / 1000)} mil tokens`
}

// "1 imagem enviada" / "3 imagens enviadas", no balão e no prompt preso no topo.
export const formatImageCount = (n: number) => (n === 1 ? '1 imagem enviada' : `${n} imagens enviadas`)
