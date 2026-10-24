import type { BoardSummary } from '../../../shared/canvas'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'

// Workspaces (no código, board; ver main/boardsStore.ts): os canvas separados e o que esta janela
// mostra. Trocar remonta o canvas inteiro (Canvas.tsx); as conversas do outro continuam no processo
// principal, como as de um card fechado.

// Conversa pedida (notificação, indicador de conversas) que está em outro workspace: a janela troca
// para ele e o canvas novo abre a conversa assim que montar.
export type PendingOpen = { cwd: string; sessionId: string }

type State = { boards: BoardSummary[]; current: string; pendingOpen: PendingOpen | null }

const initial = window.api.boards.state()
const store = createStore<State>({ ...initial, pendingOpen: null })

const firstOpen = (boards: BoardSummary[]) => (boards.find((b) => !b.closed) ?? boards[0]).id

window.api.boards.onChange((boards) =>
  store.set((s) => {
    // O desta janela foi fechado ou excluído (aqui ou em outra janela): vai para o primeiro aberto.
    const current = boards.some((b) => b.id === s.current && !b.closed) ? s.current : firstOpen(boards)
    if (current !== s.current) window.api.boards.show(current)
    return { ...s, boards, current }
  })
)

export const currentBoard = (): string => store.get().current

export const boardList = (): BoardSummary[] => store.get().boards

// Fechado: o processo principal abre de novo (a notificação de uma conversa dele, por exemplo).
export function switchBoard(id: string, pendingOpen: PendingOpen | null = null): void {
  if (id === store.get().current && !pendingOpen) return
  window.api.boards.show(id)
  store.set((s) => ({
    ...s,
    boards: s.boards.map((b) => (b.id === id && b.closed ? { ...b, closed: false } : b)),
    current: id,
    pendingOpen
  }))
}

// Workspace novo já vira o desta janela.
export function createBoard(name: string): string {
  const id = window.api.boards.create(name)
  const created: BoardSummary = { id, name, paths: [], sessions: [] }
  // O aviso da lista pode chegar depois: o novo entra já, para o menu e o canvas acharem ele.
  store.set((s) => ({ ...s, boards: s.boards.some((b) => b.id === id) ? s.boards : [...s.boards, created] }))
  switchBoard(id)
  return id
}

// A conversa que esperava o canvas montar; lida uma vez só.
export function takePendingOpen(): PendingOpen | null {
  const pending = store.get().pendingOpen
  if (pending) store.set((s) => ({ ...s, pendingOpen: null }))
  return pending
}

export function useBoards(): BoardSummary[] {
  return useStore(store, (s) => s.boards)
}

export function useCurrentBoard(): string {
  return useStore(store, (s) => s.current)
}

export { store as boardsStore }
