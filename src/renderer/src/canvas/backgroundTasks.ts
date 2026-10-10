import { createStore } from '../lib/createStore'
import { shallowEqual } from '../lib/shallowEqual'
import { useStore } from '../lib/useStore'

// Quantos comandos em segundo plano cada conversa aberta pelo chat do app tem rodando. Vem junto
// do estado do chat, como os subagentes (ver runningAgents).
type Counts = { byKey: ReadonlyMap<string, number> }
const counts = createStore<Counts>({ byKey: new Map() })

window.api.chat.onState((key, state) => {
  const next = state.backgroundTasks ?? 0
  counts.set((s) => {
    if ((s.byKey.get(key) ?? 0) === next) return s
    const byKey = new Map(s.byKey)
    if (next) byKey.set(key, next)
    else byKey.delete(key)
    return { byKey }
  })
})

// Contagem de várias conversas, na ordem das chaves (as linhas da caixa da pasta).
export function useBackgroundTasksOf(keys: readonly string[]): number[] {
  return useStore(counts, (s) => keys.map((key) => (key ? (s.byKey.get(key) ?? 0) : 0)), shallowEqual)
}
