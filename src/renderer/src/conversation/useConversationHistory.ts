import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HistoryRequest } from '../../../shared/history'
import type { OlderMessages } from './timeline/useOlderMessages'
import { createHistoryReader, type HistoryReader } from './historyReader'
import { reuseMessages } from './reuseMessages'
import type { Message } from './types'

const NONE: Message[] = []

// A conversa abre com as últimas mensagens; rolando até o topo, vêm mais estas de cada vez. Cada
// balão, comando ou resposta conta uma.
export const HISTORY_FIRST = 200
export const HISTORY_MORE = 100

type Loaded = { key: string; messages: Message[]; more: boolean }

export type ConversationHistory = {
  messages: Message[]
  loading: boolean
  // As mensagens antes das da tela (para o ChatView, ver useOlderMessages).
  older: OlderMessages
}

// Histórico salvo pelo Claude Code, do fim para trás. Relê quando o chat grava na sessão
// (revision) e quando o arquivo muda por outro caminho (updatedAt), sem ler duas vezes a mesma
// gravação (historyReader). O trecho começa na mais antiga que já está na tela e só cresce: com as
// novas chegando, as de cima não somem enquanto você lê.
export function useConversationHistory(
  projectPath: string,
  sessionId: string | undefined,
  updatedAt: string,
  // Sobe quando o chat grava algo na sessão: relê na hora, sem esperar a lista atualizar.
  revision = 0
): ConversationHistory {
  const [state, setState] = useState<Loaded | null>(null)
  const key = `${projectPath}|${sessionId}`
  const reader = useRef<HistoryReader | null>(null)
  // O que já está na tela desta conversa: o próximo pedido começa nele.
  const shown = useRef<Message[]>(NONE)
  // Anteriores pedidas que a próxima leitura ainda tem de trazer.
  const asked = useRef(0)
  const [olderFor, setOlderFor] = useState<string | null>(null)

  // Um leitor por conversa: o resultado de uma não cai na outra.
  useEffect(() => {
    if (!sessionId) return
    shown.current = NONE
    asked.current = 0
    const current = createHistoryReader(
      () => {
        const loaded = shown.current
        const extra = asked.current
        const request: HistoryRequest = loaded.length
          ? { since: loaded[0].id, count: loaded.length + extra }
          : { count: HISTORY_FIRST + extra }
        return window.api.sessions.historyPage(projectPath, sessionId, request).then((page) => ({ page, extra }))
      },
      ({ page, extra }) => {
        const kept = reuseMessages(shown.current, page.messages)
        shown.current = kept
        asked.current = Math.max(0, asked.current - extra)
        setState((prev) => (prev?.key === key && prev.messages === kept && prev.more === page.more ? prev : { key, messages: kept, more: page.more }))
        if (!asked.current) setOlderFor((k) => (k === key ? null : k))
      }
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

  const more = state?.key === key && state.more
  // Chegou ao topo: pede as anteriores (uma vez; a próxima só depois que estas chegarem).
  const loadOlder = useCallback(() => {
    if (!more || asked.current) return
    asked.current = HISTORY_MORE
    setOlderFor(key)
    reader.current?.now()
  }, [more, key])

  // Conversa nova que acabou de ganhar a sessão aqui (no primeiro envio): não há histórico a
  // esperar, a mensagem já está na tela. O "Carregando conversa…" entrava no meio e o drawer piscava.
  const [seen, setSeen] = useState({ key, sessionId, born: false })
  let born = seen.born
  if (seen.key !== key) {
    born = !seen.sessionId && !!sessionId && seen.key === `${projectPath}|undefined`
    setSeen({ key, sessionId, born })
  }

  const loadingOlder = more && olderFor === key
  const older = useMemo(() => ({ more, loading: loadingOlder, load: loadOlder }), [more, loadingOlder, loadOlder])

  if (!sessionId) return { messages: NONE, loading: false, older }
  // Enquanto a outra conversa não chega, não mostra o histórico da anterior.
  return state?.key === key ? { messages: state.messages, loading: false, older } : { messages: NONE, loading: !born, older }
}
