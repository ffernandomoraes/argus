import type { BackgroundTaskInfo } from '../../../shared/backgroundTasks'
import { createStore } from '../lib/createStore'
import { shallowEqual } from '../lib/shallowEqual'
import { useStore } from '../lib/useStore'

// O que cada conversa aberta pelo chat do app deixou rodando em segundo plano. Vem junto do estado
// do chat, como os subagentes (ver runningAgents).
type Background = {
  // Comandos, monitores e workflows (a linha "N tarefas em segundo plano").
  tasks: ReadonlyMap<string, number>
  // Quando começou a mais antiga delas (ms), para o tempo na mesma linha.
  since: ReadonlyMap<string, number>
  // Conversas com qualquer coisa em segundo plano, subagentes incluídos. O Claude Code marca a
  // conversa como parada assim que a resposta termina; a tela usa isto para mostrá-la rodando.
  busy: ReadonlySet<string>
  // Cada tarefa, com o que se sabe dela, para o drawer que mostra a saída.
  list: ReadonlyMap<string, BackgroundTask[]>
}
const background = createStore<Background>({ tasks: new Map(), since: new Map(), busy: new Set(), list: new Map() })

// Tarefa rodando agora, na ordem em que apareceram.
export type BackgroundTask = BackgroundTaskInfo & { id: string; startedAt: number }

const NO_TASKS: BackgroundTask[] = []

function taskList(starts: Record<string, number>, info: Record<string, BackgroundTaskInfo>): BackgroundTask[] {
  return Object.entries(starts)
    .map(([id, startedAt]) => ({ description: info[id]?.description ?? '', type: info[id]?.type ?? '', outputFile: info[id]?.outputFile, id, startedAt }))
    .sort((a, b) => a.startedAt - b.startedAt)
}

const sameList = (a: BackgroundTask[], b: BackgroundTask[]) => a.length === b.length && JSON.stringify(a) === JSON.stringify(b)

window.api.chat.onState((key, state) => {
  const tasks = state.backgroundTasks ?? 0
  const starts = Object.values(state.backgroundStarts ?? {})
  const since = tasks && starts.length ? Math.min(...starts) : undefined
  const busy = tasks > 0 || state.agents.some((a) => a.background)
  const list = tasks ? taskList(state.backgroundStarts ?? {}, state.backgroundInfo ?? {}) : NO_TASKS
  background.set((s) => {
    const sameTasks = sameList(s.list.get(key) ?? NO_TASKS, list)
    if ((s.tasks.get(key) ?? 0) === tasks && s.since.get(key) === since && s.busy.has(key) === busy && sameTasks) return s
    const next = { tasks: new Map(s.tasks), since: new Map(s.since), busy: new Set(s.busy), list: s.list }
    if (!sameTasks) {
      const changed = new Map(s.list)
      if (list.length) changed.set(key, list)
      else changed.delete(key)
      next.list = changed
    }
    if (tasks) next.tasks.set(key, tasks)
    else next.tasks.delete(key)
    if (since !== undefined) next.since.set(key, since)
    else next.since.delete(key)
    if (busy) next.busy.add(key)
    else next.busy.delete(key)
    return next
  })
})

// Contagem de tarefas de várias conversas, na ordem das chaves (as linhas da caixa da pasta).
export function useBackgroundTasksOf(keys: readonly string[]): number[] {
  return useStore(background, (s) => keys.map((key) => (key ? (s.tasks.get(key) ?? 0) : 0)), shallowEqual)
}

// Início da tarefa mais antiga de cada conversa, na ordem das chaves (undefined: nenhuma).
export function useBackgroundSinceOf(keys: readonly string[]): (number | undefined)[] {
  return useStore(background, (s) => keys.map((key) => (key ? s.since.get(key) : undefined)), shallowEqual)
}

// Chaves das conversas com algo em segundo plano; muda de referência só quando o conjunto muda.
export function useBackgroundBusy(): ReadonlySet<string> {
  return useStore(background, (s) => s.busy)
}

// Tarefas rodando numa conversa (pela chave dela); redesenha só quando elas mudam.
export function useBackgroundTaskList(key: string | undefined): BackgroundTask[] {
  return useStore(background, (s) => (key ? (s.list.get(key) ?? NO_TASKS) : NO_TASKS))
}
