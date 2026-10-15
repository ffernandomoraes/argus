import { createStore } from '../../lib/createStore'
import { useStore } from '../../lib/useStore'

// O que o card da tarefa isolada está fazendo nesta janela (pelo id do card): removendo a pasta,
// ou o erro da remoção. Criação e instalação vêm do processo principal (worktrees.status).
export type WorktreeJob = { kind: 'removing' } | { kind: 'failed'; error: string }

const store = createStore<ReadonlyMap<string, WorktreeJob>>(new Map())

export function setJob(id: string, job: WorktreeJob | null): void {
  store.set((prev) => {
    const next = new Map(prev)
    if (job) next.set(id, job)
    else next.delete(id)
    return next
  })
}

export const useWorktreeJob = (id: string): WorktreeJob | undefined => useStore(store, (s) => s.get(id))
