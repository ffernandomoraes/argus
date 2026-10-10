import { mkdir, rename, writeFile as write } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { shell } from 'electron'
import type { FileOpResult } from '../../shared/files'
import { expandHome, insideRoot } from '../paths'
import { changedOnDisk } from './diskBase'
import { exists, failure, OUTSIDE, relOf } from './fsHelpers'
import { invalidName, invalidPath } from './names'

const INVALID: FileOpResult = { ok: false, error: 'Nome inválido.' }
const PROJECT_ROOT: FileOpResult = { ok: false, error: 'Não dá para fazer isso com a pasta do projeto.' }
const CONFLICT: FileOpResult = { ok: false, error: 'O arquivo mudou no disco desde a última leitura.', conflict: true }

// Um item dentro da raiz, nunca a própria raiz: "." ou "src/.." mandariam o projeto inteiro
// para a Lixeira (ou o renomeariam).
function itemIn(root: string, rel: string): string | FileOpResult {
  const full = rel ? insideRoot(root, rel) : null
  if (!full) return OUTSIDE
  return full === resolve(expandHome(root)) ? PROJECT_ROOT : full
}

// base: o texto do disco que o editor leu ou gravou por último; diferente do disco, não grava.
export async function writeFile(root: string, rel: string, text: string, base?: string): Promise<FileOpResult> {
  const file = insideRoot(root, rel)
  if (!file) return OUTSIDE
  try {
    if (await changedOnDisk(file, base)) return CONFLICT
    await write(file, text, 'utf8')
    return { ok: true, path: rel }
  } catch (err) {
    return failure(err)
  }
}

// `name` pode trazer subpastas ("src/novo.ts"): as que faltarem são criadas.
export async function createItem(root: string, dirRel: string, name: string, isDir: boolean): Promise<FileOpResult> {
  if (invalidPath(name)) return INVALID
  const full = insideRoot(root, dirRel ? `${dirRel}/${name}` : name)
  if (!full || !insideRoot(root, dirRel)) return OUTSIDE
  try {
    if (await exists(full)) return { ok: false, error: 'Já existe um item com esse nome.' }
    if (isDir) await mkdir(full, { recursive: true })
    else {
      await mkdir(dirname(full), { recursive: true })
      await write(full, '', { flag: 'wx' })
    }
    return { ok: true, path: relOf(root, full) }
  } catch (err) {
    return failure(err)
  }
}

export async function renameItem(root: string, rel: string, name: string): Promise<FileOpResult> {
  if (invalidName(name)) return INVALID
  const from = itemIn(root, rel)
  if (typeof from !== 'string') return from
  const to = insideRoot(root, join(dirname(rel), name))
  if (!to) return OUTSIDE
  try {
    // Só muda maiúscula/minúscula: no disco do macOS e do Windows é o mesmo arquivo, não um conflito.
    if (from.toLowerCase() !== to.toLowerCase() && (await exists(to)))
      return { ok: false, error: 'Já existe um item com esse nome.' }
    await rename(from, to)
    return { ok: true, path: relOf(root, to) }
  } catch (err) {
    return failure(err)
  }
}

// Vai para a Lixeira (do macOS ou do Windows): dá para recuperar depois.
export async function trashItem(root: string, rel: string): Promise<FileOpResult> {
  const full = itemIn(root, rel)
  if (typeof full !== 'string') return full
  try {
    await shell.trashItem(full)
    return { ok: true, path: rel }
  } catch (err) {
    return failure(err)
  }
}

export function revealItem(root: string, rel: string): void {
  const full = insideRoot(root, rel)
  if (full) shell.showItemInFolder(full)
}
