import { EVERYTHING, forgetReads, request } from './reads'
import { changesAt, store, watching, watchingChanges, without } from './state'

// Quem observa cada pasta. O processo principal vigia as pastas que estão na tela e avisa quando
// algo muda nelas (sessions:changed).

// Pastas que ninguém olha mais guardam a lista até este tanto (as mais antigas saem): o resumo do
// grupo recolhido e o abrir pela notificação ainda leem delas sem observar.
const MAX_IDLE = 50
// Pastas sem observador, da que ficou sem há mais tempo para a mais recente.
const idle = new Set<string>()

// O processo principal vigia as pastas que estão na tela; a lista muda junto com os cards.
let syncTimer: ReturnType<typeof setTimeout> | null = null
function syncWatched(): void {
  if (syncTimer) return
  syncTimer = setTimeout(() => {
    syncTimer = null
    window.api.sessions.watch([...watching.keys()])
  }, 0)
}

// Pasta que ficou sem observador: a lista continua guardada. Passando de MAX_IDLE pastas assim, a
// que está sem observador há mais tempo é esquecida.
function release(path: string): void {
  idle.delete(path)
  idle.add(path)
  if (idle.size <= MAX_IDLE) return
  const oldest = idle.values().next().value as string
  idle.delete(oldest)
  forgetReads(oldest)
  store.set((s) =>
    s.sessions.has(oldest) || s.branch.has(oldest) || s.changes.has(oldest)
      ? {
          sessions: without(s.sessions, oldest),
          branch: without(s.branch, oldest),
          changes: without(s.changes, oldest)
        }
      : s
  )
}

export function watch(path: string): () => void {
  const count = watching.get(path) ?? 0
  watching.set(path, count + 1)
  if (count === 0) {
    idle.delete(path)
    syncWatched()
    // Primeiro observador: lê na hora, mesmo com a lista guardada, que pode estar velha (desfazer
    // a remoção da pasta mostrava a lista antiga até a próxima conferência).
    request(path, { ...EVERYTHING, changes: watchingChanges.has(path) })
  }
  return () => {
    const n = (watching.get(path) ?? 1) - 1
    if (n > 0) return void watching.set(path, n)
    watching.delete(path)
    syncWatched()
    release(path)
  }
}

// Alguém mostrando os arquivos não comitados: a pasta passa a ler o git status. Sem ninguém, eles
// saem do estado.
export function watchChanges(path: string): () => void {
  const stop = watch(path)
  const count = watchingChanges.get(path) ?? 0
  watchingChanges.set(path, count + 1)
  if (count === 0) request(path, { list: false, branch: false, changes: true })
  return () => {
    stop()
    const n = (watchingChanges.get(path) ?? 1) - 1
    if (n > 0) return void watchingChanges.set(path, n)
    watchingChanges.delete(path)
    forgetChanges(path)
  }
}

function forgetChanges(path: string): void {
  changesAt.delete(path)
  store.set((s) => (s.changes.has(path) ? { ...s, changes: without(s.changes, path) } : s))
}
