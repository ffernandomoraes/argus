import { useEffect, useRef } from 'react'
import type { WorktreeStatus } from '@argus/shared/worktrees'
import { createStore } from '../../lib/createStore'
import { useStore } from '../../lib/useStore'
import { onWindowActive, windowActive } from '../../lib/windowActivity'
import { useSessions, useUncommitted } from '../sessionsStore'
import { createWorktreePoller, type WorktreePoller } from './worktreePoller'

// Situação de cada tarefa isolada, pela pasta. Quem lê (o nome da branch no cabeçalho) usa
// useWorktreeStatus; quem pergunta ao processo principal é só a faixa do card (usePollWorktree).
const store = createStore<ReadonlyMap<string, WorktreeStatus | null>>(new Map())

export const useWorktreeStatus = (path: string): WorktreeStatus | null => useStore(store, (s) => s.get(path) ?? null)

// Quando perguntar: ver worktreePoller.ts. Os avisos de mudança são a lista de arquivos não
// comitados (relida pelo aviso do .git e pelas respostas do Claude) e a hora da última resposta.
export function usePollWorktree(path: string): WorktreeStatus | null {
  const status = useWorktreeStatus(path)
  const uncommitted = useUncommitted(path)
  const conversations = useSessions(path)
  const lastReply = conversations.reduce((max, c) => (c.repliedAt > max ? c.repliedAt : max), '')
  const fast = useRef(false)
  fast.current = !status || status.state === 'preparing'
  const poller = useRef<WorktreePoller | null>(null)

  useEffect(() => {
    const p = createWorktreePoller({
      // Igual ao que já estava (o caso comum): nada muda e a faixa não redesenha.
      read: () =>
        window.api.worktrees
          .status(path)
          .then((s) => store.set((prev) => (prev.has(path) && JSON.stringify(prev.get(path)) === JSON.stringify(s) ? prev : new Map(prev).set(path, s)))),
      fast: () => fast.current,
      active: windowActive,
      onActive: onWindowActive
    })
    poller.current = p
    return () => {
      p.stop()
      poller.current = null
    }
  }, [path])

  // A primeira passada é a montagem, que já leu; daí em diante, cada mudança avisa.
  const mounted = useRef(false)
  useEffect(() => {
    if (mounted.current) poller.current?.changed()
    mounted.current = true
  }, [uncommitted, lastReply])

  return status
}
