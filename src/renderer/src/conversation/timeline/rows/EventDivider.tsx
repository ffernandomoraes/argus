import { memo } from 'react'
import { formatClock } from '../../format'

// Divisor: troca de modelo, esforço, modo ou compactação no meio da conversa.
export const EventDivider = memo(function EventDivider({ text, at }: { text: string; at?: string }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[13px] text-faint">
      <span className="h-px flex-1 bg-line" />
      <span className="shrink-0">
        {text}
        {at && ` - ${formatClock(at)}`}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
})
