import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { conversationsIn, loadConversation } from '../agentChats/store'
import { mapLimit } from '../transcripts/mapLimit'
import { projectDir } from '../transcripts/projectDir'
import type { SearchHit } from '../../shared/sessions'

type Line = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

// Arquivos lidos ao mesmo tempo: a primeira busca numa pasta lê todas as conversas dela.
const PARALLEL = 4

// Sem acento e minúsculo: "configuracao" acha "configuração".
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Só o que foi conversado (suas mensagens e as respostas); saída de ferramenta, raciocínio,
// subagente e os recados do sistema ("<...>") ficam de fora, senão quase toda busca acharia tudo.
function conversationText(raw: string): string {
  const parts: string[] = []
  for (const rawLine of raw.split('\n')) {
    // Resposta e mensagem com anexo vêm em blocos ("text"); a sua, só texto, em "content":"...".
    if (!rawLine.startsWith('{"') || (!rawLine.includes('"text"') && !rawLine.includes('"content":"'))) continue
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
      for (const c of content) if (c?.type === 'text' && typeof c.text === 'string' && !c.text.trimStart().startsWith('<')) parts.push(c.text)
    }
  }
  return parts.join('\n').replace(/\s+/g, ' ')
}

type Text = { text: string; folded: string }
const entryOf = (text: string): Text => ({ text, folded: fold(text) })

// Texto de cada conversa, guardado até o arquivo mudar: buscar de novo (a cada letra) não relê tudo.
const cache = new Map<string, { size: number; mtimeMs: number } & Text>()

async function textOf(file: string): Promise<Text | null> {
  const info = await stat(file).catch(() => null)
  if (!info) return null
  const hit = cache.get(file)
  if (hit && hit.size === info.size && hit.mtimeMs === info.mtimeMs) return hit
  const entry = { size: info.size, mtimeMs: info.mtimeMs, ...entryOf(conversationText(await readFile(file, 'utf8').catch(() => ''))) }
  cache.set(file, entry)
  return entry
}

// Conversa com Codex, Gemini ou Cursor, gravada pelo Argus: já vem em mensagens.
const agentTexts = new Map<string, { updatedAt: string } & Text>()

function agentTextOf(id: string, updatedAt: string): Text | null {
  const hit = agentTexts.get(id)
  if (hit?.updatedAt === updatedAt) return hit
  const messages = loadConversation(id)?.messages
  if (!messages) return null
  const text = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => m.text)
    .join('\n')
    .replace(/\s+/g, ' ')
  const entry = { updatedAt, ...entryOf(text) }
  agentTexts.set(id, entry)
  return entry
}

function snippet({ text, folded }: Text, at: number, length: number): string {
  // Tirar acento pode mudar o tamanho do texto: aí a posição é aproximada.
  const pos = folded.length === text.length ? at : Math.round((at / folded.length) * text.length)
  const start = Math.max(0, pos - 40)
  const end = Math.min(text.length, pos + length + 80)
  return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '')
}

function hitIn(id: string, entry: Text | null, q: string): SearchHit | null {
  const at = entry ? entry.folded.indexOf(q) : -1
  return entry && at >= 0 ? { id, snippet: snippet(entry, at, q.length) } : null
}

// Conversas da pasta que falam do termo buscado, com um trecho em volta da primeira ocorrência.
export async function searchSessions(projectPath: string, query: string): Promise<SearchHit[]> {
  const q = fold(query.trim())
  if (q.length < 2) return []
  const dir = projectDir(projectPath)
  const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => n.endsWith('.jsonl'))
  const hits = await mapLimit(names, PARALLEL, async (name) => hitIn(name.slice(0, -'.jsonl'.length), await textOf(join(dir, name)), q))
  const agents = conversationsIn(projectPath).map((c) => hitIn(c.id, agentTextOf(c.id, c.updatedAt), q))
  return [...hits, ...agents].filter((h): h is SearchHit => h !== null)
}
