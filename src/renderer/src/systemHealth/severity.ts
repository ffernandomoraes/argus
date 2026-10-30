import type { SystemHealthState } from '../../../shared/systemHealth'

// Como o aviso da barra de cima aparece: amarelo chegando no limite, vermelho no limite ou com algo
// já encerrado por ele; nulo, sem aviso. Sem React e sem IPC, para testar.

export type HealthSeverity = 'warning' | 'critical'

export function severityOf(s: SystemHealthState): HealthSeverity | null {
  if (s.memory?.level === 'tight' || s.disk?.level === 'full' || s.events.length) return 'critical'
  if (s.memory?.level === 'low' || s.disk?.level === 'low') return 'warning'
  return null
}

const RANK = { ok: 0, low: 1, tight: 2, full: 2 } as const

// O que você já viu ao abrir o aviso: o ícone pulsa até você abrir, e de novo quando piora ou
// quando algo novo é encerrado.
export type HealthSeen = { memory: number; disk: number; events: ReadonlySet<string> }

export const NOTHING_SEEN: HealthSeen = { memory: 0, disk: 0, events: new Set() }

export function seenOf(s: SystemHealthState): HealthSeen {
  return { memory: RANK[s.memory?.level ?? 'ok'], disk: RANK[s.disk?.level ?? 'ok'], events: new Set(s.events.map((e) => e.id)) }
}

export function isFresh(s: SystemHealthState, seen: HealthSeen): boolean {
  return (
    RANK[s.memory?.level ?? 'ok'] > seen.memory || RANK[s.disk?.level ?? 'ok'] > seen.disk || s.events.some((e) => !seen.events.has(e.id))
  )
}

// Melhorou depois de você ver: o visto desce junto, e piorar de novo volta a pulsar. Sem mudança,
// o mesmo objeto (quem guarda não redesenha).
export function lowered(s: SystemHealthState, seen: HealthSeen): HealthSeen {
  const memory = Math.min(seen.memory, RANK[s.memory?.level ?? 'ok'])
  const disk = Math.min(seen.disk, RANK[s.disk?.level ?? 'ok'])
  return memory === seen.memory && disk === seen.disk ? seen : { ...seen, memory, disk }
}
