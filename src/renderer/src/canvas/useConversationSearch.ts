import { useEffect, useMemo, useState } from 'react'
import type { ConversationSummary } from './types'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
// Esperar parar de digitar antes de ler os arquivos das conversas.
const DELAY_MS = 250

export type SearchResult = { conversation: ConversationSummary; snippet?: string }

// Busca nas conversas de uma pasta: pelo título na hora e pelo que foi conversado (lido dos
// arquivos das conversas) logo depois de parar de digitar. Nulo sem nada digitado.
export function useConversationSearch(path: string, conversations: ConversationSummary[], query: string) {
  const q = fold(query.trim())
  const [content, setContent] = useState<{ path: string; q: string; hits: Map<string, string> } | null>(null)

  useEffect(() => {
    if (q.length < 2) return
    let alive = true
    const id = setTimeout(() => {
      void window.api.sessions.search(path, q).then((hits) => {
        if (alive) setContent({ path, q, hits: new Map(hits.map((h) => [h.id, h.snippet])) })
      })
    }, DELAY_MS)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [path, q])

  return useMemo(() => {
    if (!q) return null
    const fresh = content?.q === q && content.path === path
    const snippets = fresh ? content.hits : new Map<string, string>()
    // Design: o conteúdo é da conversa do protótipo (sessionId).
    const snippetOf = (c: ConversationSummary) => snippets.get(c.sessionId ?? c.id) ?? snippets.get(c.id)
    const results: SearchResult[] = conversations
      .map((c) => {
        // O trecho aparece sempre que o termo está no conteúdo, mesmo achado no título: título
        // comprido é cortado e esconderia a palavra.
        const snippet = snippetOf(c)
        if (snippet) return { conversation: c, snippet }
        return fold(c.title).includes(q) ? { conversation: c } : null
      })
      .filter((r): r is SearchResult => r !== null)
    return { results, searching: q.length >= 2 && !fresh }
  }, [q, path, conversations, content])
}
