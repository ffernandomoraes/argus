import { useEffect } from 'react'
import { createStore } from '../../lib/createStore'
import { useStore } from '../../lib/useStore'
import type { ConversationSummary } from '../types'

// Respostas que chegaram sem você estar vendo a conversa: a bolinha da lista fica verde até você
// abrir a conversa. Cada janela conta as suas; ficam guardadas (localStorage) para a janela e o app
// abertos de novo, depois de uma atualização, por exemplo, ainda mostrarem o que terminou.

const SAVED_KEY = 'unreadChats'
// Só as mais recentes: as antigas (conversa apagada, pasta fora do canvas) saem.
const MAX_SAVED = 200

function readSaved(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export const unread = createStore<ReadonlySet<string>>(new Set(readSaved()))

// Grava só o que mudou nesta janela (as que entraram e as que saíram), por cima do guardado: outra
// janela aberta grava as dela no mesmo lugar.
let lastSaved = unread.get()
unread.subscribe(() => {
  const now = unread.get()
  const added = [...now].filter((id) => !lastSaved.has(id))
  const gone = new Set([...lastSaved].filter((id) => !now.has(id)))
  lastSaved = now
  const keep = readSaved().filter((id) => !gone.has(id) && !added.includes(id))
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify([...keep, ...added].slice(-MAX_SAVED)))
  } catch {
    // Sem gravar, vale só até fechar a janela.
  }
})

// Conversas na tela agora (drawer, bloco no canvas, design aberto), com quantos mostram cada uma.
const viewing = new Map<string, number>()
// Conversas em janela separada: também contam como vistas (setPoppedOut, pelo Canvas).
let poppedOut: ReadonlySet<string> = new Set()

// Na tela, mas com você em outro app, não conta como vista (igual à notificação do sistema). A
// janela separada fica de fora: esta janela não sabe se ela está em foco.
const seen = (id: string) => (viewing.has(id) && document.hasFocus()) || poppedOut.has(id)

function markRead(ids: Iterable<string>): void {
  unread.set((s) => {
    const gone = [...ids].filter((id) => s.has(id))
    if (!gone.length) return s
    const next = new Set(s)
    for (const id of gone) next.delete(id)
    return next
  })
}

// "Marcar como não lida" (menu da conversa): a bolinha volta a ficar verde, como se a resposta
// tivesse chegado sem você ver, e some quando você abrir a conversa de novo. Para achar depois
// a conversa que abriu sem querer.
export function markUnread(id: string): void {
  unread.set((s) => (s.has(id) ? s : new Set([...s, id])))
}

export function markAsRead(id: string): void {
  markRead([id])
}

export const isUnread = (id: string): boolean => unread.get().has(id)

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

// Você voltou à janela: o que está na tela foi visto.
window.addEventListener('focus', () => markRead([...viewing.keys()]))

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
