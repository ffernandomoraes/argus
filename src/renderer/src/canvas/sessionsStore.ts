import { useEffect, useSyncExternalStore } from 'react'
import type { SessionSummary } from '../../../shared/sessions'
import type { ConversationSummary } from './types'

// Conversas de cada pasta, lidas dos arquivos do Claude Code. Não entram no canvas
// salvo nem no desfazer: são sempre relidas do disco.
// Mudanças chegam na hora pelo aviso do processo principal (sessions:changed); esta
// conferência periódica é só a rede de segurança para algum aviso perdido.
const REFRESH_MS = 10_000
const EMPTY: ConversationSummary[] = []

const byPath = new Map<string, ConversationSummary[]>()
const watching = new Map<string, number>()
const listeners = new Set<() => void>()
let version = 0

function toConversation(s: SessionSummary): ConversationSummary {
  return {
    id: s.id,
    title: s.title,
    kind: 'conversa',
    status: s.live ?? 'idle',
    updatedAt: s.updatedAt,
    contextPercent: s.contextPercent,
    sessionId: s.id
  }
}

async function refresh(path: string): Promise<void> {
  const list = (await window.api.sessions.list(path)).map(toConversation)
  // Sem mudança, não redesenha.
  if (JSON.stringify(list) === JSON.stringify(byPath.get(path))) return
  byPath.set(path, list)
  version++
  listeners.forEach((l) => l())
}

const refreshAll = () => watching.forEach((_, path) => void refresh(path))
setInterval(refreshAll, REFRESH_MS)
window.addEventListener('focus', refreshAll)
window.api.sessions.onChanged((path) => {
  if (watching.has(path)) void refresh(path)
})

// O processo principal vigia as pastas que estão na tela; a lista muda junto com os cards.
let syncTimer: ReturnType<typeof setTimeout> | null = null
function syncWatched(): void {
  if (syncTimer) return
  syncTimer = setTimeout(() => {
    syncTimer = null
    window.api.sessions.watch([...watching.keys()])
  }, 0)
}

function watch(path: string): () => void {
  watching.set(path, (watching.get(path) ?? 0) + 1)
  syncWatched()
  if (!byPath.has(path)) void refresh(path)
  return () => {
    const n = (watching.get(path) ?? 1) - 1
    if (n > 0) watching.set(path, n)
    else {
      watching.delete(path)
      syncWatched()
    }
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSessions(path: string): ConversationSummary[] {
  return byPath.get(path) ?? EMPTY
}

// Conversas de uma pasta; mantém a lista atualizada enquanto o componente estiver na tela.
export function useSessions(path: string): ConversationSummary[] {
  useEffect(() => watch(path), [path])
  return useSyncExternalStore(subscribe, () => getSessions(path))
}

// Redesenha quando qualquer lista muda; os dados vêm de getSessions.
export function useSessionsVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}
