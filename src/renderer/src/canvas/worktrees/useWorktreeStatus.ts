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
    let timer: ReturnType<typeof setTimeout> | undefined
    // A próxima pergunta só depois da resposta da anterior: com o WSL lento, perguntar a cada 2 s sem
    // esperar empilhava dezenas delas, cada uma com vários git rodando lá dentro (2026-10-23).
    const read = () =>
      void window.api.worktrees
        .status(path)
        // Igual ao que já estava (o caso comum, a cada 2 ou 15 s): nada muda e a faixa não redesenha.
        .then((s) => alive && store.set((prev) => (prev.has(path) && JSON.stringify(prev.get(path)) === JSON.stringify(s) ? prev : new Map(prev).set(path, s))))
        .catch(() => {})
        .finally(() => {
          if (alive) timer = setTimeout(read, settling ? FAST_MS : SLOW_MS)
        })
    read()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [path, uncommitted, lastReply, settling])
  return status
}
