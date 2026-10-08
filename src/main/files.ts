import { execFile } from 'node:child_process'
import { cp, lstat, mkdir, open, readdir, rename, stat, writeFile as write } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { clipboard, ClipboardItem, shell } from 'electron'
import type { FileContent, FileEntry, FileOpResult } from '../shared/files'
import { expandHome, insideRoot } from './paths'
import { gitPath, IS_WIN } from './platform'
import { powershell } from './winProcesses'

// Arquivos que o sistema cria sozinho nas pastas (Finder e Explorador do Windows).
const HIDDEN = new Set(['.git', '.DS_Store', 'Thumbs.db', 'desktop.ini'])
const READ_LIMIT = 1_000_000
// Caracteres que o Windows não aceita em nome de arquivo.
const INVALID_NAME = IS_WIN ? /[\\/<>:"|?*]/ : /\//

// Quais destes nomes da pasta o .gitignore ignora. O git também responde pelo que está dentro
// de uma pasta ignorada; arquivo já versionado nunca conta. Fora de repositório: nenhum.
function ignoredNames(dir: string, names: string[]): Promise<Set<string>> {
  return new Promise((done) => {
    if (!names.length) return done(new Set())
    const child = execFile(gitPath(), ['-C', dir, 'check-ignore', '-z', '--stdin'], { windowsHide: true }, (_err, stdout) =>
      // Sai com 1 quando nada é ignorado e 128 fora de repositório: os dois viram lista vazia.
      done(new Set(String(stdout ?? '').split('\0').filter(Boolean)))
    )
    child.stdin?.end(names.join('\0') + '\0')
  })
}

export async function listDir(root: string, rel: string): Promise<FileEntry[]> {
  const dir = insideRoot(root, rel)
  if (!dir) return []
  const entries = (await readdir(dir, { withFileTypes: true }).catch(() => [])).filter((e) => !HIDDEN.has(e.name))
  const ignored = await ignoredNames(
    dir,
    entries.map((e) => e.name)
  )
  return entries
    .map((e) => ({
      name: e.name,
      path: rel ? `${rel}/${e.name}` : e.name,
      isDir: e.isDirectory(),
      ignored: ignored.has(e.name)
    }))
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

const relOf = (root: string, full: string) => relative(resolve(expandHome(root)), full).split('\\').join('/')

const exists = (full: string) =>
  lstat(full).then(
    () => true,
    () => false
  )

const failure = (err: unknown): FileOpResult => {
  const code = (err as NodeJS.ErrnoException).code
  if (code === 'EEXIST') return { ok: false, error: 'Já existe um item com esse nome.' }
  if (code === 'ENOENT') return { ok: false, error: 'O item não existe mais.' }
  if (code === 'EACCES' || code === 'EPERM') return { ok: false, error: 'Sem permissão para isso.' }
  return { ok: false, error: (err as Error).message }
}

export async function writeFile(root: string, rel: string, text: string): Promise<FileOpResult> {
  const file = insideRoot(root, rel)
  if (!file) return { ok: false, error: 'Caminho fora do projeto.' }
  try {
    await write(file, text, 'utf8')
    return { ok: true, path: rel }
  } catch (err) {
    return failure(err)
  }
}

// `name` pode trazer subpastas ("src/novo.ts"): as que faltarem são criadas.
export async function createItem(root: string, dirRel: string, name: string, isDir: boolean): Promise<FileOpResult> {
  const full = insideRoot(root, dirRel ? `${dirRel}/${name}` : name)
  if (!full || !insideRoot(root, dirRel)) return { ok: false, error: 'Caminho fora do projeto.' }
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
  if (!name || INVALID_NAME.test(name)) return { ok: false, error: 'Nome inválido.' }
  const from = rel ? insideRoot(root, rel) : null
  const to = from && insideRoot(root, join(dirname(rel), name))
  if (!from || !to) return { ok: false, error: 'Caminho fora do projeto.' }
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
  const full = rel ? insideRoot(root, rel) : null
  if (!full) return { ok: false, error: 'Caminho fora do projeto.' }
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

// Caminhos copiados no Finder (⌘C): vêm todos em text/uri-list, um file:// por linha. O Explorador
// do Windows grava os arquivos em outro formato (lista de arquivos), lido pelo PowerShell.
async function clipboardPaths(): Promise<string[]> {
  for (const item of await clipboard.read()) {
    if (!item.types.includes('text/uri-list')) continue
    const list = await (item.getType('text/uri-list') as Promise<Blob>).then((b) => b.text())
    const paths = list
      .split(/\r?\n/)
      .filter((l) => l.startsWith('file://'))
      .map((l) => fileURLToPath(l).replace(/[\\/]$/, ''))
    if (paths.length) return paths
  }
  if (!IS_WIN) return []
  const out = await powershell('Get-Clipboard -Format FileDropList | ForEach-Object { $_.FullName }')
  return out
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/\\$/, ''))
    .filter(Boolean)
}

// ⌘C num item da árvore: grava como o Finder grava, para colar aqui ou no próprio Finder. No
// Windows, como o Explorador grava, para colar nele também.
export async function copyToClipboard(root: string, rels: string[]): Promise<void> {
  const paths = rels.map((r) => insideRoot(root, r)).filter((p): p is string => !!p)
  if (!paths.length) return
  if (IS_WIN) {
    await powershell('Set-Clipboard -LiteralPath ($env:ARGUS_PATHS -split "`n")', { ARGUS_PATHS: paths.join('\n') })
    return
  }
  const urls = paths.map((p) => pathToFileURL(p).href)
  await clipboard.write([new ClipboardItem({ 'text/uri-list': urls.join('\r\n') })])
}

// Nome livre na pasta de destino, como o Finder ao duplicar: "nome cópia.ext", "nome cópia 2.ext".
async function freeName(dir: string, name: string): Promise<string> {
  if (!(await exists(join(dir, name)))) return name
  const ext = extname(name)
  const stem = name.slice(0, name.length - ext.length)
  for (let n = 1; ; n++) {
    const candidate = `${stem} cópia${n > 1 ? ` ${n}` : ''}${ext}`
    if (!(await exists(join(dir, candidate)))) return candidate
  }
}

// Cola na pasta o que foi copiado no Finder ou na própria árvore. Nunca sobrescreve: nome repetido ganha "cópia".
export async function pasteFromClipboard(root: string, dirRel: string): Promise<FileOpResult> {
  const dir = insideRoot(root, dirRel)
  if (!dir) return { ok: false, error: 'Caminho fora do projeto.' }
  const sources = await clipboardPaths()
  if (!sources.length) {
    const hint = IS_WIN ? 'no Explorador de Arquivos com Ctrl+C' : 'no Finder com ⌘C'
    return { ok: false, error: `Nada copiado para colar. Copie arquivos ${hint}.` }
  }
  let last = ''
  try {
    for (const src of sources) {
      // Pasta colada dentro dela mesma copiaria sem fim.
      if (dir === src || dir.startsWith(src + sep)) return { ok: false, error: 'Não dá para colar uma pasta dentro dela mesma.' }
      const target = join(dir, await freeName(dir, basename(src)))
      await cp(src, target, { recursive: true, errorOnExist: true, force: false, preserveTimestamps: true })
      last = relOf(root, target)
    }
    return { ok: true, path: last }
  } catch (err) {
    return failure(err)
  }
}
