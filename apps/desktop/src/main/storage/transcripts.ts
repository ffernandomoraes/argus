import { createReadStream, createWriteStream } from 'node:fs'
import { chmod, readdir, rename, rm, stat, utimes } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { finished } from 'node:stream/promises'
import { MAIN_DIR } from '../accounts/paths'
import { tr } from '../i18n'

// Prints e anexos dentro das conversas: o Claude Code grava cada imagem colada (e cada PDF, e cada
// imagem que ele leu) em base64 dentro do .jsonl da conversa. Em 2026-10-30 eram 43% dos 1,5 GB das
// conversas. Nas paradas há mais que o prazo, a imagem vira um texto curto no mesmo lugar: a conversa
// continua abrindo e dá para retomar. As contas do Argus usam a mesma pasta (ver accounts/links.ts).

const projectsRoot = () => join(MAIN_DIR, 'projects')
const NEWLINE = Buffer.from('\n')

const removedImage = () => tr('[imagem removida]', '[image removed]')
const removedFile = () => tr('[arquivo removido]', '[file removed]')

type Json = unknown

const isBase64Block = (o: Record<string, unknown>) =>
  (o.type === 'image' || o.type === 'document') && !!o.source && typeof o.source === 'object' && (o.source as { type?: unknown }).type === 'base64'

// Troca os blocos de imagem e de arquivo em base64 por texto, em qualquer profundidade (a mensagem,
// o resultado de uma ferramenta, o pedido guardado). Devolve o mesmo objeto se não havia nenhum.
function strip(node: Json): Json {
  if (Array.isArray(node)) {
    let changed = false
    const out = node.map((x) => {
      const y = strip(x)
      if (y !== x) changed = true
      return y
    })
    return changed ? out : node
  }
  if (!node || typeof node !== 'object') return node
  const o = node as Record<string, unknown>
  if (isBase64Block(o)) return { type: 'text', text: o.type === 'image' ? removedImage() : removedFile() }
  let out: Record<string, unknown> | null = null
  for (const [key, value] of Object.entries(o)) {
    const next = strip(value)
    if (next !== value) (out ??= { ...o })[key] = next
  }
  return out ?? node
}

// O resultado da leitura de uma imagem pela ferramenta Read ({ type: 'image', file: { base64 } }) só
// serve para mostrar a imagem: sai inteiro, como o de tantas ferramentas que não gravam nenhum.
function withoutImageResult(line: Record<string, unknown>): Record<string, unknown> {
  const r = line.toolUseResult as { type?: unknown; file?: { base64?: unknown } } | undefined
  if (r?.type !== 'image' || typeof r.file?.base64 !== 'string') return line
  const { toolUseResult: _gone, ...rest } = line
  return rest
}

// A linha sem os prints e anexos; nula se não havia nenhum (ou se não é JSON: fica como está).
export function stripMediaLine(text: string): string | null {
  if (!text.includes('base64')) return null
  let line: Record<string, unknown>
  try {
    line = JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
  const next = strip(withoutImageResult(line))
  return next === line ? null : JSON.stringify(next)
}

// Todas as conversas (e as dos subagentes, em <sessão>/subagents/), com o tamanho e a data.
type Transcript = { file: string; size: number; mtimeMs: number; atimeMs: number; mode: number }

async function transcriptFiles(dir = projectsRoot()): Promise<Transcript[]> {
  const out: Transcript[] = []
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const e of entries) {
    const path = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await transcriptFiles(path)))
    else if (e.isFile() && e.name.endsWith('.jsonl')) {
      const s = await stat(path).catch(() => null)
      if (s) out.push({ file: path, size: s.size, mtimeMs: s.mtimeMs, atimeMs: s.atimeMs, mode: s.mode & 0o777 })
    }
  }
  return out
}

// A sessão dona do arquivo: <sessão>.jsonl, ou <sessão>/subagents/<agente>.jsonl.
const sessionOf = (file: string) =>
  basename(dirname(file)) === 'subagents' ? basename(dirname(dirname(file))) : basename(file, '.jsonl')

// As linhas do arquivo, só pelo \n: o readline também corta em \r, U+2028 e U+2029, que o JSON
// aceita dentro de texto (uma conversa de verdade tinha quatro), e a linha saía partida. newline: a
// linha terminava com \n (a última pode não terminar).
async function* linesOf(file: string): AsyncGenerator<{ bytes: Buffer; newline: boolean }> {
  const pending: Buffer[] = []
  for await (const chunk of createReadStream(file) as AsyncIterable<Buffer>) {
    let start = 0
    for (let i = chunk.indexOf(10); i !== -1; i = chunk.indexOf(10, start)) {
      pending.push(chunk.subarray(start, i))
      yield { bytes: Buffer.concat(pending), newline: true }
      pending.length = 0
      start = i + 1
    }
    if (start < chunk.length) pending.push(chunk.subarray(start))
  }
  if (pending.length) yield { bytes: Buffer.concat(pending), newline: false }
}

// Reescreve uma conversa sem os prints. A data do arquivo volta a ser a de antes: a limpeza não é
// atividade, e a conversa não pode subir na lista nem escapar do prazo. A permissão também (o Claude
// Code grava só para o dono ler). Se ele gravou nela no meio (retomada agora), desiste. Devolve
// quantos bytes liberou.
async function trimFile(f: Transcript): Promise<number> {
  const tmp = `${f.file}.${process.pid}.media.tmp`
  const out = createWriteStream(tmp, { mode: f.mode })
  let changed = false
  // A linha sem os prints; sem nenhum, os mesmos bytes de antes.
  const emit = async (bytes: Buffer, newline: boolean) => {
    const next = stripMediaLine(bytes.toString('utf8'))
    if (next !== null) changed = true
    const line = next === null ? bytes : Buffer.from(next)
    if (!out.write(newline ? Buffer.concat([line, NEWLINE]) : line)) await new Promise<void>((r) => out.once('drain', () => r()))
  }
  try {
    for await (const { bytes, newline } of linesOf(f.file)) await emit(bytes, newline)
    out.end()
    await finished(out)
    const now = await stat(f.file)
    if (!changed || now.size !== f.size || now.mtimeMs !== f.mtimeMs) {
      await rm(tmp, { force: true })
      return 0
    }
    const after = (await stat(tmp)).size
    await chmod(tmp, f.mode)
    await rename(tmp, f.file)
    await utimes(f.file, new Date(f.atimeMs), new Date(f.mtimeMs))
    return Math.max(0, f.size - after)
  } catch (err) {
    out.destroy()
    await rm(tmp, { force: true }).catch(() => {})
    throw err
  }
}

// As conversas que a limpeza pegaria agora: paradas há mais de `days` dias, fora as rodando.
async function dueFiles(days: number, live: ReadonlySet<string>, now: number, root?: string): Promise<Transcript[]> {
  const limit = now - days * 86_400_000
  return (await transcriptFiles(root)).filter((f) => f.mtimeMs <= limit && !live.has(sessionOf(f.file)))
}

// Quanto a limpeza liberaria agora, sem gravar nada: o que sai de cada linha com print.
export async function mediaFreeable(
  days: number,
  live: ReadonlySet<string>,
  now = Date.now(),
  root?: string
): Promise<{ conversations: number; bytes: number }> {
  let conversations = 0
  let bytes = 0
  for (const f of await dueFiles(days, live, now, root)) {
    let freed = 0
    try {
      for await (const line of linesOf(f.file)) {
        const next = stripMediaLine(line.bytes.toString('utf8'))
        if (next !== null) freed += line.bytes.length - Buffer.byteLength(next)
      }
    } catch {
      continue
    }
    if (freed > 0) {
      conversations++
      bytes += freed
    }
  }
  return { conversations, bytes }
}

// Tira os prints das conversas paradas há mais de `days` dias, fora as rodando (`live`).
export async function trimConversations(
  days: number,
  live: ReadonlySet<string>,
  now = Date.now(),
  root?: string
): Promise<{ trimmed: number; freedBytes: number }> {
  let trimmed = 0
  let freedBytes = 0
  for (const f of await dueFiles(days, live, now, root)) {
    try {
      const freed = await trimFile(f)
      if (freed > 0) {
        trimmed++
        freedBytes += freed
      }
    } catch (err) {
      console.warn('[armazenamento] não deu para tirar os prints de', f.file, err)
    }
  }
  return { trimmed, freedBytes }
}

export async function conversationsUsage(root?: string): Promise<{ count: number; bytes: number }> {
  const files = await transcriptFiles(root)
  return { count: files.filter((f) => basename(dirname(f.file)) !== 'subagents').length, bytes: files.reduce((sum, f) => sum + f.size, 0) }
}
