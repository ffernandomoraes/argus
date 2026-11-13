import { cleanTitle } from '@argus/shared/chat'
import { createStore } from '../lib/createStore'
import { useStore } from '../lib/useStore'
import type { ConversationSummary } from './types'

// Renomear uma conversa pela lista (pilha da pasta, painel de todas as conversas, card solto): o
// botão direito liga o modo de edição numa linha só, e o título dela vira campo. O nome novo aparece
// na hora e fica até a lista trazer o gravado (o arquivo da conversa muda e a lista relê), como no
// cabeçalho do drawer (ConversationView).

// Sem resposta da lista nesse prazo, volta ao que ela diz, sem ficar preso no provisório.
const SETTLE_MS = 10_000

// Em qual lista foi o botão direito. A mesma conversa pode estar em duas ao mesmo tempo (a pilha da
// pasta e o painel de todas): só a linha clicada vira campo. Com as duas, cada uma pegava o foco da
// outra, e perder o foco salva: a edição fechava antes de digitar.
export type RenamePlace = 'stack' | 'panel' | 'card'

type Editing = { id: string; place: RenamePlace; cwd: string; sessionId: string; onError: (message: string) => void }
type State = { editing: Editing | null; pending: ReadonlyMap<string, string> }

const store = createStore<State>({ editing: null, pending: new Map() })

export function startConversationRename(
  cwd: string,
  c: Pick<ConversationSummary, 'id' | 'sessionId'>,
  place: RenamePlace,
  onError: (message: string) => void
): void {
  const sessionId = c.sessionId
  if (!sessionId) return
  store.set((s) => ({ ...s, editing: { id: c.id, place, cwd, sessionId, onError } }))
}

// Fim da edição: nome novo (já sem espaços sobrando) ou nulo para cancelar.
export function finishConversationRename(id: string, place: RenamePlace, typed: string | null): void {
  const editing = store.get().editing
  if (editing?.id !== id || editing.place !== place) return
  store.set((s) => ({ ...s, editing: null }))
  const title = typed ? cleanTitle(typed) : ''
  if (!title) return
  setPending(id, title)
  const timer = setTimeout(() => clearPending(id, title), SETTLE_MS)
  // key: a sessão; a conversa aberta no drawer também fica registrada por ela (ver Chats.rename).
  void window.api.chat
    .rename({ key: editing.sessionId, cwd: editing.cwd, sessionId: editing.sessionId, title })
    .then(
      (error) => error,
      (e: unknown) => (e instanceof Error ? e.message : String(e))
    )
    .then((error) => {
      if (!error) return
      clearTimeout(timer)
      clearPending(id, title)
      editing.onError(error)
    })
}

function setPending(id: string, title: string): void {
  store.set((s) => ({ ...s, pending: new Map(s.pending).set(id, title) }))
}

function clearPending(id: string, title: string): void {
  if (store.get().pending.get(id) !== title) return
  store.set((s) => {
    const pending = new Map(s.pending)
    pending.delete(id)
    return { ...s, pending }
  })
}

export function useIsRenamingConversation(id: string, place: RenamePlace): boolean {
  return useStore(store, (s) => s.editing?.id === id && s.editing.place === place)
}

// O título a mostrar: o novo, enquanto a lista ainda traz o antigo.
export function useConversationTitle(c: ConversationSummary): string {
  return useStore(store, (s) => s.pending.get(c.id)) ?? c.title
}
