import type { LiveStatus } from '@argus/shared/history'

// Bolinha do status da conversa: trabalhando (laranja pulsando), precisa de você (vermelha).
export function StatusDot({ status, size = 9 }: { status: LiveStatus | 'interrupted' | null | undefined; size?: number }) {
  if (!status || status === 'idle') return null
  const color = status === 'running' ? 'bg-orange animate-pulse-dot' : 'bg-red'
  return <span className={`inline-block shrink-0 rounded-full ${color}`} style={{ width: size, height: size }} />
}
