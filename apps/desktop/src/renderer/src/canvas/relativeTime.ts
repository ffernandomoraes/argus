import { tr } from '../i18n'

// "agora", "há 5min", "há 2h", "há 10d", "há 3 meses", "há 2 anos". Data inválida: vazio.
export function relativeTime(iso: string, now = Date.now()): string {
  const time = new Date(iso).getTime()
  if (!Number.isFinite(time)) return ''
  const min = Math.max(0, Math.floor((now - time) / 60_000))
  if (min < 1) return tr('agora', 'now')
  if (min < 60) return tr(`há ${min}min`, `${min}m ago`)
  const h = Math.floor(min / 60)
  if (h < 24) return tr(`há ${h}h`, `${h}h ago`)
  const d = Math.floor(h / 24)
  if (d < 30) return tr(`há ${d}d`, `${d}d ago`)
  const months = Math.floor(d / 30)
  if (months < 12) return months === 1 ? tr('há 1 mês', '1 month ago') : tr(`há ${months} meses`, `${months} months ago`)
  // De 360 a 364 dias já são 12 "meses", mas ainda não um ano inteiro: conta como 1 ano.
  const years = Math.max(1, Math.floor(d / 365))
  return years === 1 ? tr('há 1 ano', '1 year ago') : tr(`há ${years} anos`, `${years} years ago`)
}
