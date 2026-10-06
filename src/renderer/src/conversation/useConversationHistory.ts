import { useEffect, useState } from 'react'
import type { Message } from './types'

// Histórico salvo pelo Claude Code. Relê quando a sessão grava algo novo (updatedAt muda).
export function useConversationHistory(
  projectPath: string,
  sessionId: string | undefined,
  updatedAt: string,
  // Sobe quando o chat grava algo na sessão: relê na hora, sem esperar a lista atualizar.
  revision = 0
): { messages: Message[]; loading: boolean } {
  const [state, setState] = useState<{ key: string; messages: Message[] } | null>(null)
  const key = `${projectPath}|${sessionId}`

  useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    window.api.sessions.history(projectPath, sessionId).then((messages) => {
      if (!cancelled) setState({ key, messages })
    })
    return () => {
      cancelled = true
    }
  }, [key, updatedAt, revision]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!sessionId) return { messages: [], loading: false }
  // Enquanto a outra conversa não chega, não mostra o histórico da anterior.
  return state?.key === key ? { messages: state.messages, loading: false } : { messages: [], loading: true }
}
