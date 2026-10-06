import { useEffect, useMemo, useState } from 'react'
import type { ConversationSummary } from './types'

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Busca nas conversas de uma pasta: pelo título na hora e pelo que foi conversado
// (lido dos arquivos da sessão) logo depois de parar de digitar.
export function useConversationSearch(path: string, conversations: ConversationSummary[], query: string) {
  const q = fold(query.trim())
  const [content, setContent] = useState<{ q: string; hits: Map<string, string> } | null>(null)

  useEffect(() => {
    if (q.length < 2) return
    let alive = true
    const id = setTimeout(() => {
      window.api.sessions.search(path, q).then((hits) => {
        if (alive) setContent({ q, hits: new Map(hits.map((h) => [h.id, h.snippet])) })
      })
    }, 250)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [path, q])

  return useMemo(() => {
    if (!q) return null
    const snippets = content?.q === q ? content.hits : new Map<string, string>()
    const results = conversations
      .filter((c) => fold(c.title).includes(q) || snippets.has(c.id))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      // Trecho só quando o achado não está no título.
      .map((c) => ({ conversation: c, snippet: fold(c.title).includes(q) ? undefined : snippets.get(c.id) }))
    return { results, searching: q.length >= 2 && content?.q !== q }
  }, [q, conversations, content])
}
