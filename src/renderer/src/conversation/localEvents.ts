import { useMemo, useSyncExternalStore } from 'react'
import type { EventKind } from '../../../shared/history'
import type { Message } from './types'

export type EventMessage = Extract<Message, { role: 'event' }>

// Trocas feitas pelos seletores do chat (modelo, esforço, modo...) não ficam no arquivo da
// sessão do Claude Code; o app guarda neste computador para mostrar o divisor no lugar certo.
// Encaixar entre as mensagens: mergeEvents.ts.
const key = (sessionId: string) => `chat-events:${sessionId}`
const CHANGED = 'chat-events-changed'
const NONE: EventMessage[] = []

function readRaw(sessionId: string): string | null {
  try {
    return localStorage.getItem(key(sessionId))
  } catch {
    return null
  }
}

function parse(raw: string | null): EventMessage[] {
  if (!raw) return NONE
  try {
    return JSON.parse(raw) as EventMessage[]
  } catch {
    return NONE
  }
}

export function addLocalEvent(sessionId: string, kind: EventKind, text: string): void {
  const event: EventMessage = { id: `local-${crypto.randomUUID()}`, role: 'event', kind, text, at: new Date().toISOString() }
  try {
    localStorage.setItem(key(sessionId), JSON.stringify([...parse(readRaw(sessionId)), event].slice(-200)))
  } catch {
    // Sem armazenamento: o divisor não aparece, a troca vale do mesmo jeito.
  }
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: sessionId }))
}

// Troca feita aqui (CHANGED) ou em outra janela (storage): cada conversa relê só a sua chave.
function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGED, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function useLocalEvents(sessionId: string | undefined): EventMessage[] {
  const raw = useSyncExternalStore(subscribe, () => (sessionId ? readRaw(sessionId) : null))
  return useMemo(() => parse(raw), [raw])
}
