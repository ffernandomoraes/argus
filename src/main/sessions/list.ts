import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { SessionSummary } from '../../shared/sessions'
import { liveSessions } from '../liveSessions'
import { mapLimit } from '../transcripts/mapLimit'
import { projectDir } from '../transcripts/projectDir'
import { percentOf } from './context'
import { emptyHead, readHead, type Head } from './head'
import { summarize, type SummaryData } from './summary'
import { readTail } from './tail'

// Arquivos lidos ao mesmo tempo: a primeira listagem pode ter centenas de conversas.
const PARALLEL = 8

type Cached = { size: number; mtimeMs: number; ino: number; head: Head; data: SummaryData | null }

// Reler só arquivos que mudaram desde a última vez. Por pasta, para os apagados saírem também.
const cache = new Map<string, Map<string, Cached>>()

export async function listSessions(projectPath: string): Promise<SessionSummary[]> {
  const dir = projectDir(projectPath)
  let names: string[]
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith('.jsonl'))
  } catch {
    cache.delete(dir)
    return []
  }
  const live = await liveSessions()
  const files = cachedIn(dir, names)
  const results = await mapLimit(names, PARALLEL, (name) => summaryOf(dir, name, files))
  return results
    .filter((s): s is SummaryData => s !== null)
    .map((s) => ({
      id: s.id,
      title: s.title,
      updatedAt: s.updatedAt,
      contextPercent: percentOf(s.usage),
      live: live.get(s.id) ?? null,
      ...(s.design && { design: true })
    }))
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
