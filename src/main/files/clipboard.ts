import { cp } from 'node:fs/promises'
import { basename, extname, join, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { clipboard, ClipboardItem } from 'electron'
import type { FileOpResult } from '../../shared/files'
import { insideRoot } from '../paths'
import { IS_WIN } from '../platform'
import { powershell } from '../winProcesses'
import { exists, failure, OUTSIDE, relOf } from './fsHelpers'

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
  if (!dir) return OUTSIDE
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
