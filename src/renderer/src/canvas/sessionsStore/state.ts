import type { UncommittedFile } from '../../../../shared/sessions'
import { createStore } from '../../lib/createStore'
import type { ConversationSummary } from '../types'

// O estado das pastas e quem observa cada uma. Sem IPC: as leituras ficam em reads.ts.

export type State = {
  sessions: ReadonlyMap<string, ConversationSummary[]>
  branch: ReadonlyMap<string, string | null>
  // Só das pastas com alguém mostrando os arquivos não comitados (useUncommitted).
  changes: ReadonlyMap<string, UncommittedFile[] | null>
}
export const store = createStore<State>({ sessions: new Map(), branch: new Map(), changes: new Map() })

// Observadores por pasta (quantos componentes mostram a pasta, e quantos mostram o git status).
export const watching = new Map<string, number>()
export const watchingChanges = new Map<string, number>()
// Quando cada pasta leu o git status pela última vez.
export const changesAt = new Map<string, number>()

// O que uma leitura trouxe; undefined = não leu essa parte (fica a guardada).
export type ReadPart = {
  list?: ConversationSummary[]
  branch?: string | null
  changes?: UncommittedFile[] | null
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export const without = <T>(map: ReadonlyMap<string, T>, key: string) => {
  const next = new Map(map)
  next.delete(key)
  return next
}

// Resultado de uma leitura no estado. Sem mudança, o mesmo estado (ninguém redesenha); a lista de
// conversas igual mantém a mesma referência, então só quem mostra a parte que mudou redesenha.
export function merge(s: State, path: string, part: ReadPart): State {
  const { list, branch, changes } = part
  const sameList = list === undefined || (s.sessions.has(path) && sameJson(s.sessions.get(path), list))
  const sameBranch = branch === undefined || (s.branch.has(path) && s.branch.get(path) === branch)
  const sameChanges = changes === undefined || (s.changes.has(path) && sameJson(s.changes.get(path), changes))
  if (sameList && sameBranch && sameChanges) return s
  return {
    sessions: list === undefined || sameList ? s.sessions : new Map(s.sessions).set(path, list),
    branch: branch === undefined || sameBranch ? s.branch : new Map(s.branch).set(path, branch),
    changes: changes === undefined || sameChanges ? s.changes : new Map(s.changes).set(path, changes)
  }
}
