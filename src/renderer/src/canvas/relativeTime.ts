// "agora", "há 5min", "há 2h", "há 10d", "há 3 meses", "há 2 anos".
export function relativeTime(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d}d`
  const months = Math.floor(d / 30)
  if (months < 12) return months === 1 ? 'há 1 mês' : `há ${months} meses`
  const years = Math.floor(d / 365)
  return years === 1 ? 'há 1 ano' : `há ${years} anos`
}
