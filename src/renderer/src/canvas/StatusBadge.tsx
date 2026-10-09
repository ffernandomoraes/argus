import type { SessionStatus } from './types'

export const STATUS_LABEL: Record<SessionStatus, string> = {
  idle: 'parado',
  running: 'rodando',
  'needs-you': 'precisa de você',
  done: 'concluído'
}

const DOT: Record<SessionStatus, string> = {
  idle: 'border border-faint',
  running: 'bg-running animate-pulse',
  'needs-you': 'bg-needs-you',
  done: 'bg-done/60'
}

// Status discreto: só uma bolinha, com o nome no tooltip.
export function StatusDot({ status }: { status: SessionStatus }) {
  return (
    <span
      title={STATUS_LABEL[status]}
      aria-label={STATUS_LABEL[status]}
      className={`inline-block size-1.5 shrink-0 rounded-full ${DOT[status]}`}
    />
  )
}
