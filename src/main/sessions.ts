import { open, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { KnownFolder, SessionSummary } from '../shared/sessions'
import { contextWindowFor } from './contextWindows'
import { liveSessions } from './liveSessions'
import { expandHome } from './paths'

// O Claude Code grava cada conversa num .jsonl dentro de uma pasta com o caminho do
// projeto "achatado": tudo que não é letra ou número vira "-".
const flatten = (path: string) => path.replace(/[^a-zA-Z0-9]/g, '-')

const projectsDir = () => join(homedir(), '.claude', 'projects')

export function sessionsDir(projectPath: string): string {
  return join(projectsDir(), flatten(expandHome(projectPath)))
}

// Os arquivos passam de MB; título e uso de contexto são regravados ao longo da conversa,
// então basta ler o começo (primeira mensagem) e o fim (dados mais recentes).
const HEAD_BYTES = 64 * 1024
const TAIL_BYTES = 512 * 1024

type Line = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

async function readSlice(file: string, start: number, length: number): Promise<string> {
  const handle = await open(file, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, start)
    return buffer.subarray(0, bytesRead).toString('utf8')
  } finally {
    await handle.close()
  }
}

// Linhas cortadas no meio (início do trecho final, fim do inicial) são descartadas.
function parseLines(text: string): Line[] {
  const out: Line[] = []
  for (const raw of text.split('\n')) {
    if (!raw.startsWith('{')) continue
    try {
      out.push(JSON.parse(raw))
    } catch {
      // linha incompleta
    }
  }
  return out
}

function userText(line: Line): string | null {
  if (line.type !== 'user' || line.isSidechain || line.isMeta) return null
  const content = line.message?.content
  const text =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.find((c: Line) => c?.type === 'text')?.text
        : null
  if (typeof text !== 'string') return null
  // Comandos e avisos internos (<command-name>, <local-command-...>) não servem de título.
  const clean = text.trim()
  return clean && !clean.startsWith('<') ? clean : null
}

function contextPercent(lines: Line[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]
    const message = l.type === 'assistant' && !l.isSidechain ? l.message : null
    const usage = message?.usage
    // "<synthetic>": aviso do próprio Claude Code (erro, interrupção), sem uso real.
    if (!usage || typeof message.model !== 'string' || message.model === '<synthetic>') continue
    // Tudo que entrou na última resposta = o que a conversa ocupa da janela agora.
    const tokens =
      (usage.input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0)
    if (tokens === 0) continue
    return Math.min(100, Math.round((tokens / contextWindowFor(message.model)) * 100))
  }
  return 0
}

async function summarize(file: string, id: string, size: number, mtime: Date): Promise<SessionSummary | null> {
  const head = parseLines(await readSlice(file, 0, Math.min(size, HEAD_BYTES)))
  const tail = size > HEAD_BYTES ? parseLines(await readSlice(file, Math.max(0, size - TAIL_BYTES), TAIL_BYTES)) : head

  // Título: o renomeado (/rename), senão o gerado pelo Claude, senão a primeira mensagem.
  const last = (type: string, key: string): string | undefined => {
    for (let i = tail.length - 1; i >= 0; i--) if (tail[i].type === type) return tail[i][key]
    return undefined
  }
  const firstPrompt = head.map(userText).find(Boolean) ?? tail.map(userText).find(Boolean)
  const title = last('custom-title', 'customTitle') ?? last('ai-title', 'aiTitle') ?? firstPrompt
  // Sessão sem nenhuma mensagem (aberta e fechada) não entra na lista.
  if (!title) return null

  return {
    id,
    title: title.split('\n')[0].slice(0, 120),
    updatedAt: mtime.toISOString(),
    contextPercent: contextPercent(tail),
    live: null
  }
}

// Reler só arquivos que mudaram desde a última vez.
const cache = new Map<string, { size: number; mtimeMs: number; summary: SessionSummary | null }>()

export async function listSessions(projectPath: string): Promise<SessionSummary[]> {
  const dir = sessionsDir(projectPath)
  let names: string[]
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith('.jsonl'))
  } catch {
    return []
  }
  const live = await liveSessions()
  const results = await Promise.all(
    names.map(async (name) => {
      const file = join(dir, name)
      try {
        const info = await stat(file)
        const hit = cache.get(file)
        if (hit && hit.size === info.size && hit.mtimeMs === info.mtimeMs) return hit.summary
        const summary = await summarize(file, name.slice(0, -'.jsonl'.length), info.size, info.mtime)
        cache.set(file, { size: info.size, mtimeMs: info.mtimeMs, summary })
        return summary
      } catch {
        return null
      }
    })
  )
  return results.filter((s): s is SessionSummary => s !== null).map((s) => ({ ...s, live: live.get(s.id) ?? null }))
}

// Caminho de cada pasta de ~/.claude/projects; não muda, então fica guardado.
const folderPaths = new Map<string, string>()

// Pastas temporárias (rascunhos de sessões) não são projetos.
const TEMP = /^\/(private\/)?(tmp|var\/folders)\//

// O nome achatado não volta ao caminho ("a-b" pode ser "a/b"): o caminho vem do `cwd` gravado
// nas conversas. Vale o que, achatado, dá o próprio nome da pasta; os outros são `cd` no meio.
// Procura no texto, sem montar as linhas: um print colado na primeira mensagem deixa a linha
// com centenas de KB, e o `cwd` vem depois do conteúdo.
const CWD = /"cwd":"((?:[^"\\]|\\.)*)"/g
const CWD_HEAD_BYTES = 1024 * 1024

async function folderPath(dir: string, files: string[]): Promise<string | null> {
  const known = folderPaths.get(dir)
  if (known) return known
  for (const file of files) {
    const path = join(projectsDir(), dir, file)
    const { size } = await stat(path)
    const slices = [() => readSlice(path, 0, CWD_HEAD_BYTES)]
    if (size > CWD_HEAD_BYTES) slices.push(() => readSlice(path, size - TAIL_BYTES, TAIL_BYTES))
    for (const read of slices) {
      for (const [, raw] of (await read()).matchAll(CWD)) {
        let cwd: string
        try {
          cwd = JSON.parse(`"${raw}"`)
        } catch {
          continue
        }
        if (flatten(cwd) !== dir) continue
        folderPaths.set(dir, cwd)
        return cwd
      }
    }
  }
  return null
}

// Pastas onde o Claude Code já conversou, da conversa mais recente para a mais antiga. Ficam de
// fora a pasta do usuário (é onde rodam as conversas sem projeto), as temporárias e as que
// não existem mais no disco.
export async function listKnownFolders(): Promise<KnownFolder[]> {
  let dirs: string[]
  try {
    dirs = await readdir(projectsDir())
  } catch {
    return []
  }
  const home = homedir()
  const results = await Promise.all(
    dirs.map(async (dir): Promise<KnownFolder | null> => {
      try {
        const names = (await readdir(join(projectsDir(), dir))).filter((n) => n.endsWith('.jsonl'))
        const files = await Promise.all(
          names.map(async (name) => ({ name, info: await stat(join(projectsDir(), dir, name)) }))
        )
        // Sessão vazia (aberta e fechada) não conta como conversa.
        const used = files.filter((f) => f.info.size > 0).sort((a, b) => b.info.mtimeMs - a.info.mtimeMs)
        if (!used.length) return null
        const path = await folderPath(dir, used.map((f) => f.name))
        if (!path || path === home || TEMP.test(path)) return null
        if (!(await stat(path)).isDirectory()) return null
        return { path, updatedAt: used[0].info.mtime.toISOString() }
      } catch {
        return null
      }
    })
  )
  return results
    .filter((f): f is KnownFolder => f !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
