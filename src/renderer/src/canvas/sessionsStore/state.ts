import type { UncommittedFile } from '../../../../shared/sessions'
import { createStore } from '../../lib/createStore'
import type { ConversationSummary } from '../types'

// O estado das pastas e quem observa cada uma. Sem IPC: as leituras ficam em reads.ts.

export type State = {
  sessions: ReadonlyMap<string, ConversationSummary[]>
  branch: ReadonlyMap<string, string | null>
  // Só das pastas com alguém mostrando os arquivos não comitados (useUncommitted).
  changes: ReadonlyMap<string, UncommittedFile[] | null>
  // Pastas cuja lista não respondeu na última leitura (o WSL parado ou travado): a lista guardada
  // fica, e o card vazio diz que vai tentar de novo, em vez de "Nenhuma conversa ainda".
  unreadable: ReadonlySet<string>
}
export const store = createStore<State>({ sessions: new Map(), branch: new Map(), changes: new Map(), unreadable: new Set() })

// Observadores por pasta (quantos componentes mostram a pasta, e quantos mostram o git status).
export const watching = new Map<string, number>()
export const watchingChanges = new Map<string, number>()
// Quando cada pasta leu o git status pela última vez.
export const changesAt = new Map<string, number>()

// O que uma leitura trouxe; undefined = não leu essa parte (fica a guardada).
export type ReadPart = {
  list?: ConversationSummary[]
  // A lista foi pedida e a pasta não respondeu: fica a guardada, marcada.
  unreadable?: true
  branch?: string | null
  changes?: UncommittedFile[] | null
}

// A lista da pasta: ainda não lida, sem resposta da pasta ou lida.
export type ListState = 'loading' | 'unreadable' | 'ready'

export const listStateOf = (s: State, path: string): ListState =>
  s.unreadable.has(path) ? 'unreadable' : s.sessions.has(path) ? 'ready' : 'loading'

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export const without = <T>(map: ReadonlyMap<string, T>, key: string) => {
  const next = new Map(map)
  next.delete(key)
  return next
}

export const toggled = (set: ReadonlySet<string>, key: string, on: boolean): ReadonlySet<string> => {
  const next = new Set(set)
  if (on) next.add(key)
  else next.delete(key)
  return next
}

// Lista que mudou: as conversas iguais às de antes continuam sendo o mesmo objeto, e só a linha da
// que mudou redesenha (o memo das outras compara pela referência). Cada passo do Claude muda a
// data de uma conversa só, e a lista chegava toda nova.
function keepSame(before: ConversationSummary[] | undefined, list: ConversationSummary[]): ConversationSummary[] {
  if (!before?.length) return list
  const byId = new Map(before.map((c) => [c.id, c]))
  return list.map((c) => {
    const old = byId.get(c.id)
    return old && sameJson(old, c) ? old : c
  })
}

// Resultado de uma leitura no estado. Sem mudança, o mesmo estado (ninguém redesenha); a lista de
// conversas igual mantém a mesma referência, então só quem mostra a parte que mudou redesenha.
export function merge(s: State, path: string, part: ReadPart): State {
  const { list, branch, changes } = part
  // A lista lida tira a marca de não lida; a pasta sem resposta põe.
  const unreadable = part.unreadable ?? (list === undefined ? undefined : false)
  const sameList = list === undefined || (s.sessions.has(path) && sameJson(s.sessions.get(path), list))
  const sameBranch = branch === undefined || (s.branch.has(path) && s.branch.get(path) === branch)
  const sameChanges = changes === undefined || (s.changes.has(path) && sameJson(s.changes.get(path), changes))
  const sameMark = unreadable === undefined || s.unreadable.has(path) === unreadable
  if (sameList && sameBranch && sameChanges && sameMark) return s
  return {
    sessions: list === undefined || sameList ? s.sessions : new Map(s.sessions).set(path, keepSame(s.sessions.get(path), list)),
    branch: branch === undefined || sameBranch ? s.branch : new Map(s.branch).set(path, branch),
    changes: changes === undefined || sameChanges ? s.changes : new Map(s.changes).set(path, changes),
    unreadable: unreadable === undefined || sameMark ? s.unreadable : toggled(s.unreadable, path, unreadable)
  }
}
