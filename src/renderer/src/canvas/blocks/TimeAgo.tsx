import { useNow } from '../../lib/clock'
import { relativeTime } from '../relativeTime'

// "há 5min" à direita de uma linha, com a data completa no title. Acompanha o relógio comum da
// janela (um timer por minuto para todos): só este pedaço redesenha a cada minuto, não a lista.
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const now = useNow(60_000)
  const date = new Date(iso)
  const valid = Number.isFinite(date.getTime())
  return (
    <span
      title={valid ? date.toLocaleString('pt-BR') : undefined}
      className={`ml-auto shrink-0 text-[11px] text-faint ${className ?? ''}`}
    >
      {relativeTime(iso, now)}
    </span>
  )
}
