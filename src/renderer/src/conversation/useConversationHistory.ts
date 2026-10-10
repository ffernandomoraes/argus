import { useEffect, useRef, useState } from 'react'
import { createHistoryReader, type HistoryReader } from './historyReader'
import { reuseMessages } from './reuseMessages'
import type { Message } from './types'

const NONE: Message[] = []

// Histórico salvo pelo Claude Code. Relê quando o chat grava na sessão (revision) e quando o
// arquivo muda por outro caminho (updatedAt), sem ler duas vezes a mesma gravação (historyReader).
export function useConversationHistory(
  projectPath: string,
  sessionId: string | undefined,
  updatedAt: string,
  // Sobe quando o chat grava algo na sessão: relê na hora, sem esperar a lista atualizar.
  revision = 0
): { messages: Message[]; loading: boolean } {
  const [state, setState] = useState<{ key: string; messages: Message[] } | null>(null)
  const key = `${projectPath}|${sessionId}`
  const reader = useRef<HistoryReader | null>(null)

  // Um leitor por conversa: o resultado de uma não cai na outra.
  useEffect(() => {
    if (!sessionId) return
    const current = createHistoryReader(
      () => window.api.sessions.history(projectPath, sessionId),
      (messages) =>
        setState((prev) => {
          const kept = reuseMessages(prev?.key === key ? prev.messages : NONE, messages)
          return prev?.key === key && prev.messages === kept ? prev : { key, messages: kept }
        })
    )
    reader.current = current
    return () => {
      current.dispose()
      if (reader.current === current) reader.current = null
    }
  }, [key, projectPath, sessionId])

  useEffect(() => {
    reader.current?.sync(revision, updatedAt ? Date.parse(updatedAt) || 0 : 0)
  }, [key, revision, updatedAt])

  // Conversa nova que acabou de ganhar a sessão aqui (no primeiro envio): não há histórico a
  // esperar, a mensagem já está na tela. O "Carregando conversa…" entrava no meio e o drawer piscava.
  const [seen, setSeen] = useState({ key, sessionId, born: false })
  let born = seen.born
  if (seen.key !== key) {
    born = !seen.sessionId && !!sessionId && seen.key === `${projectPath}|undefined`
    setSeen({ key, sessionId, born })
  }

  if (!sessionId) return { messages: NONE, loading: false }
  // Enquanto a outra conversa não chega, não mostra o histórico da anterior.
  return state?.key === key ? { messages: state.messages, loading: false } : { messages: NONE, loading: !born }
}
