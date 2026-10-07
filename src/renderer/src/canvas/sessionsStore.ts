import { useEffect, useSyncExternalStore } from 'react'
import type { SessionSummary, UncommittedFile } from '../../../shared/sessions'
import type { ConversationSummary } from './types'

// Conversas de cada pasta, lidas dos arquivos do Claude Code, e a branch atual dela. Não entram
// no canvas salvo nem no desfazer: são sempre relidas do disco.
// Mudanças chegam na hora pelo aviso do processo principal (sessions:changed); esta
// conferência periódica é só a rede de segurança para algum aviso perdido.
const REFRESH_MS = 10_000
const EMPTY: ConversationSummary[] = []

const byPath = new Map<string, ConversationSummary[]>()
const branchByPath = new Map<string, string | null>()
const changesByPath = new Map<string, UncommittedFile[] | null>()
const watching = new Map<string, number>()
// Pastas com alguém mostrando os arquivos não comitados: só elas rodam o git status.
const watchingChanges = new Map<string, number>()
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
  const withChanges = watchingChanges.has(path)
  const [sessions, branch, changes] = await Promise.all([
    window.api.sessions.list(path),
    window.api.sessions.branch(path),
    withChanges ? window.api.sessions.changes(path) : null
  ])
  const list = sessions.map(toConversation)
  const changesSame = !withChanges || JSON.stringify(changes) === JSON.stringify(changesByPath.get(path))
  // Sem mudança, não redesenha.
  if (JSON.stringify(list) === JSON.stringify(byPath.get(path)) && branch === branchByPath.get(path) && changesSame) return
  byPath.set(path, list)
  branchByPath.set(path, branch)
  // O drawer pode ter fechado enquanto o git rodava.
  if (withChanges && watchingChanges.has(path)) changesByPath.set(path, changes)
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

// Branch atual da pasta; nulo fora de repositório ou antes da primeira leitura.
export function useBranch(path: string): string | null {
  useEffect(() => watch(path), [path])
  return useSyncExternalStore(subscribe, () => branchByPath.get(path) ?? null)
}

// Arquivos não comitados do repositório da pasta; nulo fora de repositório ou antes da
// primeira leitura.
export function useUncommitted(path: string): UncommittedFile[] | null {
  useEffect(() => {
    const stop = watch(path)
    watchingChanges.set(path, (watchingChanges.get(path) ?? 0) + 1)
    if (!changesByPath.has(path)) void refresh(path)
    return () => {
      stop()
      const n = (watchingChanges.get(path) ?? 1) - 1
      if (n > 0) watchingChanges.set(path, n)
      else {
        watchingChanges.delete(path)
        changesByPath.delete(path)
      }
    }
  }, [path])
  return useSyncExternalStore(subscribe, () => changesByPath.get(path) ?? null)
}

// Relê na hora, sem esperar o aviso do .git ou a conferência periódica: criar ou salvar um
// arquivo não mexe no .git, e a árvore de código quer a cor certa logo.
export function refreshNow(path: string): void {
  if (watching.has(path)) void refresh(path)
}

// Redesenha quando qualquer lista muda; os dados vêm de getSessions.
export function useSessionsVersion(): number {
  return useSyncExternalStore(subscribe, () => version)
}
