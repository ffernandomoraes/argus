import { open, readdir, stat } from 'node:fs/promises'
import type { FileContent, FileEntry } from '../shared/files'
import { insideRoot } from './paths'

const HIDDEN = new Set(['.git', '.DS_Store'])
const READ_LIMIT = 1_000_000

export async function listDir(root: string, rel: string): Promise<FileEntry[]> {
  const dir = insideRoot(root, rel)
  if (!dir) return []
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((e) => !HIDDEN.has(e.name))
    .map((e) => ({ name: e.name, path: rel ? `${rel}/${e.name}` : e.name, isDir: e.isDirectory() }))
    .sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
}

export async function readFile(root: string, rel: string): Promise<FileContent> {
  const file = insideRoot(root, rel)
  if (!file) return { ok: false, error: 'Caminho fora do projeto.' }
  try {
    const { size } = await stat(file)
    const handle = await open(file, 'r')
    const buffer = Buffer.alloc(Math.min(size, READ_LIMIT))
    await handle.read(buffer, 0, buffer.length, 0)
    await handle.close()
    // Byte zero nos primeiros 8 KB = arquivo binário (imagem, fonte, zip...).
    if (buffer.subarray(0, 8000).includes(0)) return { ok: false, error: 'Arquivo binário, sem pré-visualização.' }
    return { ok: true, text: buffer.toString('utf8'), size, truncated: size > READ_LIMIT }
  } catch (err) {
    return { ok: false, error: `Não consegui ler o arquivo: ${(err as Error).message}` }
  }
}
