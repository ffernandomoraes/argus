// "agora", "há 5min", "há 2h", "há 10d", "há 3 meses", "há 2 anos". Data inválida: vazio.
export function relativeTime(iso: string, now = Date.now()): string {
  const time = new Date(iso).getTime()
  if (!Number.isFinite(time)) return ''
  const min = Math.max(0, Math.floor((now - time) / 60_000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d}d`
  const months = Math.floor(d / 30)
  if (months < 12) return months === 1 ? 'há 1 mês' : `há ${months} meses`
  // De 360 a 364 dias já são 12 "meses", mas ainda não um ano inteiro: conta como 1 ano.
  const years = Math.max(1, Math.floor(d / 365))
  return years === 1 ? 'há 1 ano' : `há ${years} anos`
}
