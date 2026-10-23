import type { SessionChange } from '../../../../shared/sessions'
import type { ConversationSummary } from '../types'
import { folderList } from './convert'
import { changesAt, merge, store, watching, watchingChanges, type ReadPart } from './state'
import { noteFinished } from './unread'

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

// Leituras numeradas: a resposta de uma leitura mais velha que a última aplicada (ou que o
// esquecimento da pasta) não volta a valer.
let tickets = 0
const settled = new Map<string, number>()

async function read(path: string, need: Need): Promise<void> {
  const ticket = ++tickets
  const withChanges = need.changes && watchingChanges.has(path)
  if (withChanges) changesAt.set(path, Date.now())
  // Cada parte entra no estado assim que chega: a branch ou o git status presos num WSL que não
  // responde não seguram a lista, nem o aviso de que ela não foi lida. A leitura só termina com
  // todas, para a próxima da pasta não rodar junto.
  const parts = await Promise.allSettled([
    need.list &&
      listOf(path).then((list) => {
        apply(path, ticket, list ? { list } : { unreadable: true })
        if (list) clearRetry(path)
        else retrySoon(path)
      }),
    need.branch && window.api.sessions.branch(path).then((branch) => apply(path, ticket, { branch })),
    withChanges &&
      window.api.sessions
        .changes(path)
        // O drawer pode ter fechado enquanto o git rodava.
        .then((changes) => apply(path, ticket, { changes: watchingChanges.has(path) ? changes : undefined }))
  ])
  for (const part of parts) if (part.status === 'rejected') console.error('[sessões] não consegui ler a pasta', path, part.reason)
}

// A lista da pasta com os designs dela; nula se a pasta não respondeu (o WSL parado ou travado) ou
// se a leitura falhou: a guardada fica.
async function listOf(path: string): Promise<ConversationSummary[] | null> {
  try {
    const [sessions, designs] = await Promise.all([window.api.sessions.list(path), window.api.design.list(path)])
    return sessions ? folderList(sessions, designs) : null
  } catch (err) {
    console.error('[sessões] não consegui ler as conversas da pasta', path, err)
    return null
  }
}

// Pasta que não respondeu: pergunta de novo logo, sem esperar a conferência periódica. No processo
// principal, a pergunta espera a leitura que ainda está em andamento: a lista aparece assim que a
// pasta responder (a máquina virtual do WSL ligando leva alguns segundos), sem abrir outra leitura.
const RETRY_MS = 3000
const retries = new Map<string, ReturnType<typeof setTimeout>>()

function retrySoon(path: string): void {
  if (retries.has(path)) return
  retries.set(
    path,
    setTimeout(() => {
      retries.delete(path)
      if (watching.has(path)) request(path, { list: true, branch: false, changes: false })
    }, RETRY_MS)
  )
}

function clearRetry(path: string): void {
  clearTimeout(retries.get(path))
  retries.delete(path)
}

// Parte de uma leitura no estado, se ela ainda vale. Com a lista, as conversas que terminaram sem
// ninguém ver ganham a bolinha.
function apply(path: string, ticket: number, part: ReadPart): void {
  if (ticket < (settled.get(path) ?? 0)) return
  settled.set(path, ticket)
  const before = store.get().sessions.get(path)
  store.set((s) => merge(s, path, part))
  if (part.list) noteFinished(before, store.get().sessions.get(path))
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

// Pasta esquecida: uma leitura dela ainda em andamento não a traz de volta (o número dela fica
// abaixo do marcado aqui).
export function forgetReads(path: string): void {
  if (reading.has(path)) settled.set(path, ++tickets)
  else settled.delete(path)
  clearRetry(path)
  changesAt.delete(path)
  clearTimeout(changesTimers.get(path))
  changesTimers.delete(path)
}
