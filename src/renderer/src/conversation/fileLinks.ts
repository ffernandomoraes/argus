import { createContext } from 'react'

// Trecho do arquivo citado num link: linha inicial e final (iguais quando é uma linha só).
export type LineRange = { start: number; end: number }

// Quem mostra o arquivo quando um link da conversa aponta para ele. Nulo: não há onde abrir.
export const FileLinkContext = createContext<((path: string, lines?: LineRange) => void) | null>(null)

// "src/a.ts#L42-L51" → caminho + linhas. Links da web e e-mail não são arquivo.
export function parseFileLink(href: string): { path: string; lines?: LineRange } | null {
  if (/^(https?|mailto):/i.test(href)) return null
  const [rawPath, hash = ''] = href.replace(/^file:\/\//, '').split('#')
  if (!rawPath) return null
  let path: string
  try {
    path = decodeURIComponent(rawPath)
  } catch {
    path = rawPath
  }
  const m = /^L(\d+)(?:-L?(\d+))?$/.exec(hash)
  if (!m) return { path }
  const start = Number(m[1])
  return { path, lines: { start, end: m[2] ? Number(m[2]) : start } }
}
