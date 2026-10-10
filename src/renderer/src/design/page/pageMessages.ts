import { pagePath } from '../address/routeText'
import type { CommentPositions, NewComment } from '../comments/types'

// Avisos da página do protótipo, por postMessage (scripts de designPicker/scripts): endereço,
// links, recarregar, Esc e comentários. Qualquer página pode mandar mensagem, então cada campo é
// conferido e cortado no mesmo tamanho que o script do app manda.
export type PageMessage =
  | { kind: 'location'; path: string; title: string }
  | { kind: 'links'; paths: string[] }
  | { kind: 'reload' }
  | { kind: 'escape' }
  | { kind: 'comment-add'; comment: NewComment }
  | { kind: 'comment-pos'; pos: CommentPositions }

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '')
const coord = (value: unknown) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// Só os pontos com id de verdade e posição em números; no máximo 500.
function positions(value: unknown): CommentPositions | null {
  if (!value || typeof value !== 'object') return null
  const out: CommentPositions = {}
  for (const [key, p] of Object.entries(value).slice(0, 500)) {
    const id = Number(key)
    if (!Number.isSafeInteger(id)) continue
    if (p === null) out[id] = null
    else if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number') out[id] = [p[0], p[1], p[2] === true]
  }
  return out
}

function newComment(d: Record<string, unknown>): NewComment | null {
  const id = Number(d.id)
  if (!Number.isSafeInteger(id) || id <= 0) return null
  return {
    id,
    name: text(d.name, 40) || 'elemento',
    text: text(d.text, 400),
    html: text(d.html, 3000),
    path: text(d.path, 1000),
    source: text(d.source, 1000),
    x: coord(d.x),
    y: coord(d.y)
  }
}

// `origin`: a da página aberta; o endereço avisado só vale se continuar nela.
export function parsePageMessage(data: unknown, origin: string): PageMessage | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  switch (d.argus) {
    case 'location': {
      const path = pagePath(d.path, origin)
      return path ? { kind: 'location', path, title: text(d.title, 120) } : null
    }
    case 'links':
      if (!Array.isArray(d.paths)) return null
      return { kind: 'links', paths: d.paths.filter((p): p is string => typeof p === 'string' && p.startsWith('/') && p.length <= 500).slice(0, 200) }
    case 'reload':
      return { kind: 'reload' }
    case 'escape':
      return { kind: 'escape' }
    case 'comment-add': {
      const comment = newComment(d)
      return comment && { kind: 'comment-add', comment }
    }
    case 'comment-pos': {
      const pos = positions(d.pos)
      return pos && { kind: 'comment-pos', pos }
    }
    default:
      return null
  }
}
