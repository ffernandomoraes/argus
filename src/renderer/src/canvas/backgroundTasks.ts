import { createStore } from '../lib/createStore'
import { shallowEqual } from '../lib/shallowEqual'
import { useStore } from '../lib/useStore'

// O que cada conversa aberta pelo chat do app deixou rodando em segundo plano. Vem junto do estado
// do chat, como os subagentes (ver runningAgents).
type Background = {
  // Comandos, monitores e workflows (a linha "N tarefas em segundo plano").
  tasks: ReadonlyMap<string, number>
  // Conversas com qualquer coisa em segundo plano, subagentes incluídos. O Claude Code marca a
  // conversa como parada assim que a resposta termina; a tela usa isto para mostrá-la rodando.
  busy: ReadonlySet<string>
}
const background = createStore<Background>({ tasks: new Map(), busy: new Set() })

window.api.chat.onState((key, state) => {
  const tasks = state.backgroundTasks ?? 0
  const busy = tasks > 0 || state.agents.some((a) => a.background)
  background.set((s) => {
    if ((s.tasks.get(key) ?? 0) === tasks && s.busy.has(key) === busy) return s
    const next = { tasks: new Map(s.tasks), busy: new Set(s.busy) }
    if (tasks) next.tasks.set(key, tasks)
    else next.tasks.delete(key)
    if (busy) next.busy.add(key)
    else next.busy.delete(key)
    return next
  })
})

// Contagem de tarefas de várias conversas, na ordem das chaves (as linhas da caixa da pasta).
export function useBackgroundTasksOf(keys: readonly string[]): number[] {
  return useStore(background, (s) => keys.map((key) => (key ? (s.tasks.get(key) ?? 0) : 0)), shallowEqual)
}

// Chaves das conversas com algo em segundo plano; muda de referência só quando o conjunto muda.
export function useBackgroundBusy(): ReadonlySet<string> {
  return useStore(background, (s) => s.busy)
}
