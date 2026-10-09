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

// Na caixa da pasta a bolinha abre a linha: maior, cheia e, rodando, com um halo.
const LARGE_DOT: Record<SessionStatus, string> = {
  idle: 'border-[1.5px] border-faint',
  running: 'bg-running ring-[3px] ring-running/20 animate-pulse',
  'needs-you': 'bg-needs-you',
  done: 'bg-done'
}

// Status discreto: só uma bolinha, com o nome no tooltip.
export function StatusDot({ status, large = false }: { status: SessionStatus; large?: boolean }) {
  return (
    <span
      title={STATUS_LABEL[status]}
      aria-label={STATUS_LABEL[status]}
      className={`inline-block shrink-0 rounded-full ${large ? `size-2 ${LARGE_DOT[status]}` : `size-1.5 ${DOT[status]}`}`}
    />
  )
}
