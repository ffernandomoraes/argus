import type { SessionStatus } from './types'

const STATUS_LABEL: Record<SessionStatus, string> = {
  idle: 'parado',
  running: 'rodando',
  'needs-you': 'precisa de você',
  done: 'resposta nova'
}

// A pulsação só com animação ligada no sistema (Reduzir movimento desliga).
const DOT: Record<SessionStatus, string> = {
  idle: 'border border-faint',
  running: 'bg-running motion-safe:animate-pulse',
  'needs-you': 'bg-needs-you',
  done: 'bg-done'
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
