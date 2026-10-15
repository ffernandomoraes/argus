import { useEffect } from 'react'
import type { WorktreeStatus } from '../../../../shared/worktrees'
import { createStore } from '../../lib/createStore'
import { useStore } from '../../lib/useStore'
import { useSessions, useUncommitted } from '../sessionsStore'

// Situação de cada tarefa isolada, pela pasta. Quem lê (o nome da branch no cabeçalho) usa
// useWorktreeStatus; quem pergunta ao processo principal é só a faixa do card (usePollWorktree).
const store = createStore<ReadonlyMap<string, WorktreeStatus | null>>(new Map())

export const useWorktreeStatus = (path: string): WorktreeStatus | null => useStore(store, (s) => s.get(path) ?? null)

// Preparando (criando a pasta, instalando dependências) ou com conversa rodando: confere de perto.
// Fora isso, a cada mudança nos arquivos (o aviso do git status), a cada resposta e, sem aviso, de
// tempos em tempos (um commit ou a branch renomeada pelo agente não mexem nos arquivos).
const FAST_MS = 2000
const SLOW_MS = 15_000

export function usePollWorktree(path: string): WorktreeStatus | null {
  const status = useWorktreeStatus(path)
  const uncommitted = useUncommitted(path)
  const conversations = useSessions(path)
  const lastReply = conversations.reduce((max, c) => (c.repliedAt > max ? c.repliedAt : max), '')
  const busy = conversations.some((c) => c.status === 'running')
  const settling = !status || status.state === 'preparing' || busy
  useEffect(() => {
    let alive = true
    const read = () =>
      void window.api.worktrees
        .status(path)
        .then((s) => alive && store.set((prev) => new Map(prev).set(path, s)))
        .catch(() => {})
    read()
    const timer = setInterval(read, settling ? FAST_MS : SLOW_MS)
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [path, uncommitted, lastReply, settling])
  return status
}
