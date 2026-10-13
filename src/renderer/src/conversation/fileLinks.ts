import { createContext } from 'react'
import { IS_WIN } from '../platform'

// Trecho do arquivo citado num link: linha inicial e final (iguais quando é uma linha só).
export type LineRange = { start: number; end: number }

// Quem mostra o arquivo quando um link da conversa aponta para ele. Nulo: não há onde abrir.
export const FileLinkContext = createContext<((path: string, lines?: LineRange) => void) | null>(null)
// Mostra o arquivo de um link no Finder ou no Explorador (botão direito no link). Nulo: sem a opção.
export const FileRevealContext = createContext<((path: string) => void) | null>(null)

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
  // file:///C:/proj/a.ts deixa uma barra antes da letra do disco.
  if (IS_WIN && /^\/[a-zA-Z]:[\\/]/.test(path)) path = path.slice(1)
  const m = /^L(\d+)(?:-L?(\d+))?$/.exec(hash)
  if (!m) return { path }
  const start = Number(m[1])
  return { path, lines: { start, end: m[2] ? Number(m[2]) : start } }
}

// Código em linha que é caminho de arquivo ("out/video.mp4", "src/a.ts:42") vira link: o Claude
// costuma citar o arquivo assim, sem link. Precisa de uma barra e de extensão no fim, senão
// "/remote-control" e "react-dom/client" virariam link. Devolve o href ("src/a.ts#L42") ou null.
export function inlineFileHref(text: string): string | null {
  const m = /^([^\s"'`*?<>|{}$#%]*[\\/][^\s"'`*?<>|{}$#%\\/:]+\.[a-zA-Z0-9]{1,8})(?::(\d+)(?:[-:](\d+))?)?$/.exec(text)
  if (!m || /^[a-z][a-z0-9+.-]*:\/\//i.test(text)) return null
  const [, path, start, end] = m
  // "a.ts:42:7" é linha e coluna; "a.ts:42-51", um trecho.
  if (!start) return path
  return end && text.includes(`-${end}`) ? `${path}#L${start}-L${end}` : `${path}#L${start}`
}
