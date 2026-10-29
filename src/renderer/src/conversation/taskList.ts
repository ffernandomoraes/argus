import type { BackgroundTask } from '../canvas/backgroundTasks'
import type { TaskRef } from '../canvas/CanvasContext'

// Uma aba do drawer das tarefas: a tarefa e, enquanto roda, quando começou.
export type TaskItem = TaskRef & { startedAt?: number }

// As abas depois de uma mudança: as que já estavam (as que terminaram ficam), as rodando agora com o
// que se sabe delas e a aberta pelo chat. Mesmo conteúdo: a mesma lista.
export function mergeTasks(seen: TaskItem[], running: BackgroundTask[], extra: TaskRef | undefined): TaskItem[] {
  const byId = new Map(seen.map((t) => [t.id, t]))
  for (const t of running) {
    const before = byId.get(t.id)
    byId.set(t.id, {
      ...before,
      id: t.id,
      description: t.description || before?.description || '',
      outputFile: t.outputFile ?? before?.outputFile,
      startedAt: t.startedAt
    })
  }
  if (extra) {
    const before = byId.get(extra.id)
    byId.set(extra.id, { ...before, ...extra, description: before?.description || extra.description, outputFile: extra.outputFile ?? before?.outputFile })
  }
  const next = [...byId.values()]
  return JSON.stringify(next) === JSON.stringify(seen) ? seen : next
}

