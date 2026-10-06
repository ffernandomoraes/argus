import { useEffect, useState } from 'react'
import type { EventKind } from '../../../shared/history'
import type { Message } from './types'

type EventMessage = Extract<Message, { role: 'event' }>

// Trocas feitas pelos seletores do chat (modelo, esforço, modo...) não ficam no arquivo da
// sessão do Claude Code; o app guarda neste computador para mostrar o divisor no lugar certo.
const key = (sessionId: string) => `chat-events:${sessionId}`
const CHANGED = 'chat-events-changed'

function read(sessionId: string): EventMessage[] {
  try {
    return JSON.parse(localStorage.getItem(key(sessionId)) ?? '[]') as EventMessage[]
  } catch {
    return []
  }
}

export function addLocalEvent(sessionId: string, kind: EventKind, text: string): void {
  const event: EventMessage = { id: `local-${crypto.randomUUID()}`, role: 'event', kind, text, at: new Date().toISOString() }
  try {
    localStorage.setItem(key(sessionId), JSON.stringify([...read(sessionId), event].slice(-200)))
  } catch {
    // Sem armazenamento: o divisor não aparece, a troca vale do mesmo jeito.
  }
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: sessionId }))
}

export function useLocalEvents(sessionId: string | undefined): EventMessage[] {
  const [events, setEvents] = useState<EventMessage[]>(() => (sessionId ? read(sessionId) : []))
  useEffect(() => {
    if (!sessionId) return setEvents([])
    setEvents(read(sessionId))
    const refresh = () => setEvents(read(sessionId))
    const onChanged = (e: Event) => (e as CustomEvent).detail === sessionId && refresh()
    const onStorage = (e: StorageEvent) => e.key === key(sessionId) && refresh()
    window.addEventListener(CHANGED, onChanged)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(CHANGED, onChanged)
      window.removeEventListener('storage', onStorage)
    }
  }, [sessionId])
  return events
}

// Encaixa os divisores do app entre as mensagens pelo horário e tira repetições:
// a troca de modelo feita aqui também aparece no histórico quando a próxima resposta chega.
export function mergeEvents(messages: Message[], events: EventMessage[]): Message[] {
  if (!events.length) return messages
  const pending = [...events].sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''))
  const merged: Message[] = []
  for (const m of messages) {
    while (pending.length && m.at && (pending[0].at ?? '') <= m.at) merged.push(pending.shift()!)
    merged.push(m)
  }
  merged.push(...pending)

  const out: Message[] = []
  const lastText: Partial<Record<EventKind, string>> = {}
  let localModelSinceReply = false
  for (const m of merged) {
    if (m.role === 'event') {
      if (lastText[m.kind] === m.text) continue
      const derived = m.kind === 'model' && !m.id.startsWith('local-')
      if (derived && localModelSinceReply) continue
      if (m.kind === 'model' && m.id.startsWith('local-')) localModelSinceReply = true
      lastText[m.kind] = m.text
    } else if (m.role !== 'user') {
      localModelSinceReply = false
    }
    out.push(m)
  }
  return out
}
