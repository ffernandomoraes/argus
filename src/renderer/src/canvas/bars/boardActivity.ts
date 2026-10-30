import type { BoardSummary } from '../../../../shared/canvas'
import type { ActiveChat, InterruptedChat } from '../../../../shared/chat'
import { createStore, type ReadableStore } from '../../lib/createStore'
import { useStore } from '../../lib/useStore'
import { activeChats } from '../activeChats'
import { boardsStore } from '../boards'
import { displayPath } from '../factory'

// O que acontece nos workspaces que esta janela não mostra, para a bolinha do menu de workspaces.

export type BoardStatus = 'needs-you' | 'running' | 'interrupted' | 'done' | null

// A conversa é do workspace: a pasta dela está nele, ou ela foi posta solta nele. A mesma pasta em
// dois workspaces conta para os dois.
export const boardHas = (board: BoardSummary, chat: ActiveChat): boolean =>
  board.paths.includes(displayPath(chat.cwd)) || board.sessions.includes(chat.sessionId ?? chat.key)

// Workspaces onde uma conversa parou de trabalhar sem esta janela estar nele: ficam "concluídos"
// até a janela abrir o workspace. A lista das pastas que não estão na tela não é lida (é ela que
// dá a bolinha verde por conversa), então o sinal vem da lista de conversas ativas: a que saiu
// dela terminou.
const done = createStore<ReadonlySet<string>>(new Set())

let before = activeChats.get()
activeChats.subscribe(() => {
  const now = activeChats.get()
  const still = new Set(now.map((c) => c.key))
  const ended = before.filter((c) => !still.has(c.key))
  before = now
  if (!ended.length) return
  const { boards, current } = boardsStore.get()
  const hit = boards.filter((b) => b.id !== current && ended.some((c) => boardHas(b, c)))
  if (hit.length) done.set((s) => new Set([...s, ...hit.map((b) => b.id)]))
})

// Aberto nesta janela: foi visto.
boardsStore.subscribe(() => {
  const { current } = boardsStore.get()
  done.set((s) => {
    if (!s.has(current)) return s
    const next = new Set(s)
    next.delete(current)
    return next
  })
})

// Esperando você vale mais que trabalhando, que vale mais que interrompida (o Argus fechou com ela
// trabalhando), que vale mais que concluído.
export function boardStatus(
  board: BoardSummary,
  chats: ActiveChat[],
  finished: ReadonlySet<string>,
  interrupted: InterruptedChat[] = []
): BoardStatus {
  let running = false
  for (const c of chats) {
    if (!boardHas(board, c)) continue
    if (c.status === 'needs-you') return 'needs-you'
    running = true
  }
  if (running) return 'running'
  if (interrupted.some((c) => board.paths.includes(displayPath(c.cwd)) || board.sessions.includes(c.sessionId))) return 'interrupted'
  return finished.has(board.id) ? 'done' : null
}

// Só leitura, para os testes; na tela, useDoneBoards.
export const doneBoards: ReadableStore<ReadonlySet<string>> = done

export function useDoneBoards(): ReadonlySet<string> {
  return useStore(done)
}
