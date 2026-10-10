import { Elapsed } from '../../Elapsed'
import { formatTokens } from '../../format'

// Passo em andamento: o que o Claude está fazendo, há quanto tempo e quantos tokens já gerou.
export function WorkingRow({ label, startedAt, tokens }: { label: string; startedAt?: number; tokens: number }) {
  return (
    <div className="flex min-w-0 items-center gap-2 py-0.5 text-[13px] text-muted">
      <span className="min-w-0 truncate">{label}</span>
      {startedAt !== undefined && (
        <span className="shrink-0 tabular-nums text-faint">
          <Elapsed since={startedAt} />
          {tokens > 0 && ` - ${formatTokens(tokens)}`}
        </span>
      )}
    </div>
  )
}
