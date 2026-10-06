import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { sessionsDir } from './sessions'

type Line = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export type SearchHit = { id: string; snippet: string }

// Sem acento e minúsculo: "configuração" acha "configuracao".
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Só o que foi conversado (suas mensagens e as respostas); saídas de ferramentas ficam de fora.
function conversationText(raw: string): string {
  const parts: string[] = []
  for (const rawLine of raw.split('\n')) {
    if (!rawLine.startsWith('{"') || !rawLine.includes('"text"')) continue
    let l: Line
    try {
      l = JSON.parse(rawLine)
    } catch {
      continue
    }
    if ((l.type !== 'user' && l.type !== 'assistant') || l.isSidechain || l.isMeta) continue
    const content = l.message?.content
    if (typeof content === 'string') {
      if (!content.trimStart().startsWith('<')) parts.push(content)
    } else if (Array.isArray(content)) {
      for (const c of content) if (c?.type === 'text' && !c.text.trimStart().startsWith('<')) parts.push(c.text)
    }
  }
  return parts.join('\n').replace(/\s+/g, ' ')
}

// Texto de cada sessão, guardado até o arquivo mudar: buscar de novo não relê tudo.
const cache = new Map<string, { size: number; mtimeMs: number; text: string; folded: string }>()

async function textOf(file: string): Promise<{ text: string; folded: string } | null> {
  const info = await stat(file).catch(() => null)
  if (!info) return null
  const hit = cache.get(file)
  if (hit && hit.size === info.size && hit.mtimeMs === info.mtimeMs) return hit
  const text = conversationText(await readFile(file, 'utf8').catch(() => ''))
  // O texto sem acento tem o mesmo tamanho na maioria dos casos; o trecho usa a posição aproximada.
  const entry = { size: info.size, mtimeMs: info.mtimeMs, text, folded: fold(text) }
  cache.set(file, entry)
  return entry
}

function snippet(text: string, folded: string, at: number, length: number): string {
  // Ajuste quando remover acentos mudou o tamanho do texto.
  const pos = folded.length === text.length ? at : Math.round((at / folded.length) * text.length)
  const start = Math.max(0, pos - 40)
  const end = Math.min(text.length, pos + length + 80)
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '')
}

// Conversas da pasta que falam do termo buscado, com um trecho em volta da primeira ocorrência.
export async function searchSessions(projectPath: string, query: string): Promise<SearchHit[]> {
  const q = fold(query.trim())
  if (q.length < 2) return []
  const dir = sessionsDir(projectPath)
  const names = await readdir(dir).catch(() => [] as string[])
  const hits = await Promise.all(
    names
      .filter((n) => n.endsWith('.jsonl'))
      .map(async (name) => {
        const entry = await textOf(join(dir, name))
        const at = entry ? entry.folded.indexOf(q) : -1
        return entry && at >= 0 ? { id: name.slice(0, -'.jsonl'.length), snippet: snippet(entry.text, entry.folded, at, q.length) } : null
      })
  )
  return hits.filter((h): h is SearchHit => h !== null)
}
