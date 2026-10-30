import type { SystemHealthState } from '../../../shared/systemHealth'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'

// Memória e disco do computador e o que parou por falta deles, como o processo principal manda
// (main/systemHealth): o aviso da barra de cima e a linha da conversa fechada para liberar memória.
const health = createStore<SystemHealthState | null>(null)

let received = false
window.api.health.onState((s) => {
  received = true
  health.set(s)
})
void window.api.health.get().then((s) => {
  // O aviso chegou antes da resposta: ele é mais novo.
  if (!received) health.set(s)
})

export function useSystemHealth(): SystemHealthState | null {
  return useStore(health)
}

// A conversa foi fechada para liberar memória e ainda não voltou a trabalhar.
export function useWasFreed(sessionId: string | undefined): boolean {
  return useStore(health, (s) => !!sessionId && !!s?.freed.includes(sessionId))
}
