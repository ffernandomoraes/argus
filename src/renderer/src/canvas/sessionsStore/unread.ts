import { useEffect } from 'react'
import { createStore } from '../../lib/createStore'
import { useStore } from '../../lib/useStore'
import type { ConversationSummary } from '../types'

// Respostas que chegaram sem você estar vendo a conversa: a bolinha da lista fica verde até você
// abrir a conversa. Só nesta janela e até fechar o app.

export const unread = createStore<ReadonlySet<string>>(new Set())

// Conversas na tela agora (drawer, bloco no canvas, design aberto), com quantos mostram cada uma.
const viewing = new Map<string, number>()
// Conversas em janela separada: também contam como vistas (setPoppedOut, pelo Canvas).
let poppedOut: ReadonlySet<string> = new Set()

const seen = (id: string) => viewing.has(id) || poppedOut.has(id)

function markRead(ids: Iterable<string>): void {
  unread.set((s) => {
    const gone = [...ids].filter((id) => s.has(id))
    if (!gone.length) return s
    const next = new Set(s)
    for (const id of gone) next.delete(id)
    return next
  })
}

// Lista nova de uma pasta: conversa que estava trabalhando (ou esperando você) e parou, sem
// ninguém olhando, vira não lida.
export function noteFinished(before: ConversationSummary[] | undefined, after: ConversationSummary[] | undefined): void {
  if (!before || !after) return
  const was = new Map(before.map((c) => [c.id, c.status]))
  const done = after.filter((c) => {
    const prev = was.get(c.id)
    return c.status === 'idle' && (prev === 'running' || prev === 'needs-you') && !seen(c.id)
  })
  if (done.length) unread.set((s) => new Set([...s, ...done.map((c) => c.id)]))
}

// A conversa está na tela enquanto o componente estiver montado: marca como lida.
export function useViewing(id: string | undefined): void {
  useEffect(() => {
    if (!id) return
    viewing.set(id, (viewing.get(id) ?? 0) + 1)
    markRead([id])
    return () => {
      const n = (viewing.get(id) ?? 1) - 1
      if (n > 0) viewing.set(id, n)
      else viewing.delete(id)
    }
  }, [id])
}

export function setPoppedOut(ids: ReadonlySet<string>): void {
  poppedOut = ids
  markRead(ids)
}

export function useIsUnread(id: string): boolean {
  return useStore(unread, (s) => s.has(id))
}
