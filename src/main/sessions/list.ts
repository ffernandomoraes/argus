import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { SessionSummary } from '../../shared/sessions'
import { userHome } from '../claudeHome'
import { tr } from '../i18n'
import { withTimeout } from '../lib/timeout'
import { liveSessions } from '../liveSessions'
import { mapLimit } from '../transcripts/mapLimit'
import { projectDir } from '../transcripts/projectDir'
import { percentOf } from './context'
import { emptyHead, readHead, type Head } from './head'
import { summarize, type SummaryData } from './summary'
import { readTail } from './tail'

// Arquivos lidos ao mesmo tempo: a primeira listagem pode ter centenas de conversas.
const PARALLEL = 8

// Sem resposta da pasta de conversas nesse tempo (a máquina virtual do WSL parada ou travada), a
// leitura conta como não feita.
const ANSWER_MS = 8000

type Cached = { size: number; mtimeMs: number; ino: number; head: Head; data: SummaryData | null }

// Reler só arquivos que mudaram desde a última vez. Por pasta, para os apagados saírem também.
const cache = new Map<string, Map<string, Cached>>()

// Nulo quando a pasta não respondeu ou não deu para ler: a janela fica com a lista que já tinha.
// Antes a falha virava lista vazia, e as conversas sumiam do card e voltavam quando o WSL
// respondia (2026-10-23). Lista vazia só quando não há conversa nenhuma.
export async function listSessions(projectPath: string): Promise<SessionSummary[] | null> {
  const dir = projectDir(projectPath)
  let found: string[] | null
  try {
    found = await withTimeout(namesIn(dir), ANSWER_MS, null)
  } catch (err) {
    if (!(await noConversations(err, projectPath))) return null
    cache.delete(dir)
    return []
  }
  if (!found) return null
  const names = found.filter((n) => n.endsWith('.jsonl'))
  const live = await liveSessions()
  const files = cachedIn(dir, names)
  const results = await mapLimit(names, PARALLEL, (name) => summaryOf(dir, name, files))
  return results
    .filter((s): s is SummaryData => s !== null)
    .map((s) => ({
      id: s.id,
      title: s.title || tr('Conversa sem título', 'Untitled chat'),
      updatedAt: s.updatedAt,
      repliedAt: s.repliedAt,
      contextPercent: percentOf(s.usage),
      live: live.get(s.id) ?? null,
      ...(s.design && { design: true })
    }))
}

// Leitura da pasta em andamento: quem pergunta enquanto ela não volta (o WSL travado) espera a
// mesma, em vez de abrir outra que também ficaria presa.
const reading = new Map<string, Promise<string[]>>()

function namesIn(dir: string): Promise<string[]> {
  let job = reading.get(dir)
  if (!job) {
    job = readdir(dir).finally(() => reading.delete(dir))
    reading.set(dir, job)
  }
  return job
}

// A pasta de conversas não existe porque não há conversa ainda, e não porque o lugar onde o Claude
// Code grava ficou sem resposta: a pasta do usuário de quem roda o Claude (no WSL, a do Linux)
// responde.
async function noConversations(err: unknown, projectPath: string): Promise<boolean> {
  if ((err as NodeJS.ErrnoException).code !== 'ENOENT') return false
  const home = stat(userHome(projectPath)).then(
    (s) => s.isDirectory(),
    () => false
  )
  return withTimeout(home, ANSWER_MS, false)
}

// Resumos guardados da pasta, já sem os de arquivos que não existem mais.
function cachedIn(dir: string, names: string[]): Map<string, Cached> {
  let files = cache.get(dir)
  if (!files) {
    files = new Map()
    cache.set(dir, files)
  }
  const present = new Set(names)
  for (const name of files.keys()) if (!present.has(name)) files.delete(name)
  return files
}

async function summaryOf(dir: string, name: string, files: Map<string, Cached>): Promise<SummaryData | null> {
  const file = join(dir, name)
  try {
    const info = await stat(file)
    const hit = files.get(name)
    if (hit && hit.size === info.size && hit.mtimeMs === info.mtimeMs && hit.ino === info.ino) return hit.data
    // O começo já lido continua valendo enquanto o arquivo só cresce.
    const keep = hit && hit.ino === info.ino && info.size >= hit.size
    const head = await readHead(file, info.size, keep ? hit.head : emptyHead())
    const tail = await readTail(file, info.size, head.firstPrompt === null)
    const data = summarize(name.slice(0, -'.jsonl'.length), info.mtime, head, tail)
    files.set(name, { size: info.size, mtimeMs: info.mtimeMs, ino: info.ino, head, data })
    return data
  } catch {
    return null
  }
}
