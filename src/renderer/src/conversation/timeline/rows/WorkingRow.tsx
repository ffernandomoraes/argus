import type { ChatActivity, ChatRetry } from '../../../../../shared/chat'
import { useNow } from '../../../lib/clock'
import { Elapsed } from '../../Elapsed'
import { formatTokens } from '../../format'
import { RevealText } from '../RevealText'
import { workingStatus } from '../workingStatus'

// Passo em andamento: o que o Claude está fazendo (o rótulo troca com animação, ver RevealText), há
// quanto tempo e quantos tokens já gerou. Esperando muito, a frase muda; a API falhando, mostra o
// motivo e a contagem até a nova tentativa; compactando, uma barra de andamento.
export function WorkingRow({
  activity,
  foreground,
  retry,
  compactingSince,
  startedAt,
  tokens
}: {
  activity?: ChatActivity
  foreground: number
  retry?: ChatRetry
  compactingSince?: number
  startedAt?: number
  tokens: number
}) {
  const now = useNow(1000)
  const status = workingStatus({ activity, foreground, retry, compactingSince, turnStartedAt: startedAt, now })
  return (
    <div className="flex min-w-0 items-center gap-2 py-0.5 text-[13px] text-muted">
      <RevealText text={status.label} />
      {status.detail && <span className="shrink-0 tabular-nums text-faint">{status.detail}</span>}
      {status.progress !== undefined && (
        <span className="h-[3px] w-16 shrink-0 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={status.progress} aria-valuemin={0} aria-valuemax={100}>
          {/* Pela escala, não pela largura: anda sem refazer o layout a cada quadro. */}
          <span
            className="block h-full origin-left rounded-full bg-running transition-transform duration-1000 ease-linear"
            style={{ transform: `scaleX(${status.progress / 100})` }}
          />
        </span>
      )}
      {startedAt !== undefined && (
        <span className="shrink-0 tabular-nums text-faint">
          <Elapsed since={startedAt} />
          {tokens > 0 && ` - ${formatTokens(tokens)}`}
        </span>
      )}
    </div>
  )
}
