import type { SessionChange } from '../../../../shared/sessions'
import { folderList } from './convert'
import { changesAt, merge, store, watching, watchingChanges } from './state'

// Leituras das pastas pelo processo principal: a lista de conversas (com os designs), a branch e o
// git status. Cada pedido diz o que quer reler (Need): o aviso de uma conversa relê a lista e, com
// limite de tempo (requestChangesSoon), o git status, o mais caro (um processo git por pasta); o
// aviso do .git e o refreshNow releem o git status na hora; a conferência periódica, quando vencido.

// O que reler.
export type Need = { list: boolean; branch: boolean; changes: boolean }
export const EVERYTHING: Need = { list: true, branch: true, changes: true }

// O que cada motivo do aviso pede (ver SessionChange). Sem motivo, tudo.
export function needFor(change: SessionChange | undefined): Need {
  if (change === 'git') return { list: false, branch: true, changes: true }
  if (change === 'transcript' || change === 'status') return { list: true, branch: false, changes: false }
  return EVERYTHING
}

// Leituras numeradas: a resposta de uma leitura que não é mais nova que a última aplicada (ou que
// o esquecimento da pasta) não volta a valer.
let tickets = 0
const settled = new Map<string, number>()

async function read(path: string, need: Need): Promise<void> {
  const ticket = ++tickets
  const withChanges = need.changes && watchingChanges.has(path)
  if (withChanges) changesAt.set(path, Date.now())
  const [sessions, designs, branch, changes] = await Promise.all([
    need.list ? window.api.sessions.list(path) : null,
    need.list ? window.api.design.list(path) : null,
    need.branch ? window.api.sessions.branch(path) : undefined,
    withChanges ? window.api.sessions.changes(path) : undefined
  ])
  if (ticket <= (settled.get(path) ?? 0)) return
  settled.set(path, ticket)
  store.set((s) =>
    merge(s, path, {
      list: sessions && designs ? folderList(sessions, designs) : undefined,
      branch,
      // O drawer pode ter fechado enquanto o git rodava.
      changes: watchingChanges.has(path) ? changes : undefined
    })
  )
}

// Uma leitura por pasta de cada vez. Pedido que chega com uma em andamento fica guardado e roda
// quando ela terminar (juntando o que cada pedido quis); pedidos do mesmo instante (os hooks de um
// card montando juntos) viram uma leitura só.
const queued = new Map<string, Need>()
const reading = new Set<string>()

export function request(path: string, need: Need): void {
  const pending = queued.get(path)
  if (pending) {
    pending.list ||= need.list
    pending.branch ||= need.branch
    pending.changes ||= need.changes
    return
  }
  queued.set(path, { ...need })
  if (!reading.has(path)) queueMicrotask(() => start(path))
}

function start(path: string): void {
  const pending = queued.get(path)
  if (!pending || reading.has(path)) return
  queued.delete(path)
  // Ninguém mais mostra a pasta: não lê.
  if (!watching.has(path)) return
  reading.add(path)
  read(path, pending)
    .catch((err: unknown) => console.error('[sessões] não consegui ler a pasta', path, err))
    .finally(() => {
      reading.delete(path)
      start(path)
    })
}

// O Claude editando arquivos só avisa pela conversa (o .git não muda): o git status também é
// relido, mas no máximo uma vez a cada CHANGES_GAP_MS por pasta. Aviso que chega antes disso
// marca uma releitura para quando o intervalo vencer (vários avisos viram uma só).
const CHANGES_GAP_MS = 4000
const changesTimers = new Map<string, ReturnType<typeof setTimeout>>()

export function requestChangesSoon(path: string): void {
  if (!watchingChanges.has(path) || changesTimers.has(path)) return
  const wait = CHANGES_GAP_MS - (Date.now() - (changesAt.get(path) ?? 0))
  if (wait <= 0) return request(path, { list: false, branch: false, changes: true })
  changesTimers.set(
    path,
    setTimeout(() => {
      changesTimers.delete(path)
      if (watchingChanges.has(path)) request(path, { list: false, branch: false, changes: true })
    }, wait)
  )
}

// Pasta esquecida: uma leitura dela ainda em andamento não a traz de volta.
export function forgetReads(path: string): void {
  if (reading.has(path)) settled.set(path, tickets)
  else settled.delete(path)
  changesAt.delete(path)
  clearTimeout(changesTimers.get(path))
  changesTimers.delete(path)
}
