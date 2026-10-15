import { mkdir, rename, writeFile as write } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { execFile, spawn } from 'node:child_process'
import { app, shell, type BrowserWindow } from 'electron'
import type { FileOpResult } from '../../shared/files'
import { expandHome, insideRoot } from '../paths'
import { IS_LINUX, IS_MAC, IS_WIN } from '../platform'
import { changedOnDisk } from './diskBase'
import { tr } from '../i18n'
import { exists, failure, nameTaken, outside, relOf } from './fsHelpers'
import { invalidName, invalidPath } from './names'
import { trashPath } from '../wsl'

const invalid = (): FileOpResult => ({ ok: false, error: tr('Nome inválido.', 'Invalid name.') })
const projectRoot = (): FileOpResult => ({
  ok: false,
  error: tr('Não dá para fazer isso com a pasta do projeto.', 'You can’t do that with the project folder.')
})
const conflict = (): FileOpResult => ({
  ok: false,
  error: tr('O arquivo mudou no disco desde a última leitura.', 'The file changed on disk since it was last read.'),
  conflict: true
})

// Um item dentro da raiz, nunca a própria raiz: "." ou "src/.." mandariam o projeto inteiro
// para a Lixeira (ou o renomeariam).
function itemIn(root: string, rel: string): string | FileOpResult {
  const full = rel ? insideRoot(root, rel) : null
  if (!full) return outside()
  return full === resolve(expandHome(root)) ? projectRoot() : full
}

// base: o texto do disco que o editor leu ou gravou por último; diferente do disco, não grava.
export async function writeFile(root: string, rel: string, text: string, base?: string): Promise<FileOpResult> {
  const file = insideRoot(root, rel)
  if (!file) return outside()
  try {
    if (await changedOnDisk(file, base)) return conflict()
    await write(file, text, 'utf8')
    return { ok: true, path: rel }
  } catch (err) {
    return failure(err)
  }
}

// `name` pode trazer subpastas ("src/novo.ts"): as que faltarem são criadas.
export async function createItem(root: string, dirRel: string, name: string, isDir: boolean): Promise<FileOpResult> {
  if (invalidPath(name)) return invalid()
  const full = insideRoot(root, dirRel ? `${dirRel}/${name}` : name)
  if (!full || !insideRoot(root, dirRel)) return outside()
  try {
    if (await exists(full)) return nameTaken()
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
  if (invalidName(name)) return invalid()
  const from = itemIn(root, rel)
  if (typeof from !== 'string') return from
  const to = insideRoot(root, join(dirname(rel), name))
  if (!to) return outside()
  try {
    // Só muda maiúscula/minúscula: no disco do macOS e do Windows é o mesmo arquivo, não um conflito.
    if (from.toLowerCase() !== to.toLowerCase() && (await exists(to)))
      return nameTaken()
    await rename(from, to)
    return { ok: true, path: relOf(root, to) }
  } catch (err) {
    return failure(err)
  }
}

// Vai para a Lixeira (do macOS ou do Windows; numa pasta do WSL, a do Linux): dá para recuperar
// depois.
export async function trashItem(root: string, rel: string): Promise<FileOpResult> {
  const full = itemIn(root, rel)
  if (typeof full !== 'string') return full
  try {
    await trashPath(full)
    return { ok: true, path: rel }
  } catch (err) {
    return failure(err)
  }
}

// A própria pasta aberta no Finder ou no Explorador de Arquivos (não ela selecionada na de cima).
export function openFolder(path: string): void {
  void shell.openPath(expandHome(path))
}

export function revealItem(root: string, rel: string): void {
  const full = insideRoot(root, rel)
  if (full) shell.showItemInFolder(full)
}

// Imagem, vídeo, PDF: no Mac, o Quick Look (o mesmo da barra de espaço no Finder), sem sair do app.
// No Windows e no Linux, o app padrão do tipo.
export async function viewItem(win: BrowserWindow | null, root: string, rel: string): Promise<void> {
  const full = insideRoot(root, rel)
  if (!full || !(await exists(full))) return
  if (IS_MAC && win) win.previewFile(full)
  else void shell.openPath(full)
}

// Abre o arquivo no navegador padrão, não no app padrão do tipo (o PDF iria para o Preview). Sem
// navegador registrado, cai no app padrão do tipo.
export async function openInBrowser(root: string, rel: string): Promise<void> {
  const full = insideRoot(root, rel)
  if (!full) return
  if (IS_LINUX) return openInLinuxBrowser(full)
  try {
    const browser = (await app.getApplicationInfoForProtocol('https://')).path
    const [cmd, args] = IS_WIN ? [browser, [full]] : ['open', ['-a', browser, full]]
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => void shell.openPath(full)).unref()
  } catch {
    void shell.openPath(full)
  }
}

// Linux: o navegador padrão vem do xdg-settings (o .desktop dele, "firefox.desktop") e abre pelo
// gtk-launch. Sem um dos dois (KDE sem o GTK, por exemplo), cai no app padrão do tipo.
function openInLinuxBrowser(full: string): void {
  execFile('xdg-settings', ['get', 'default-web-browser'], { timeout: 5000 }, (err, stdout) => {
    const desktop = String(stdout ?? '').trim()
    if (err || !desktop.endsWith('.desktop')) return void shell.openPath(full)
    const child = spawn('gtk-launch', [desktop, full], { detached: true, stdio: 'ignore' })
    child.on('error', () => void shell.openPath(full))
    child.on('exit', (code) => code && void shell.openPath(full))
    child.unref()
  })
}
