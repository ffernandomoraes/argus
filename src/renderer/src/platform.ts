// O que muda na interface entre macOS e Windows: atalhos, nomes do sistema e o formato dos
// caminhos. Os absolutos vêm do sistema ("/Users/ana/proj" no Mac, "C:\Users\ana\proj" no
// Windows); os relativos à pasta do projeto (árvore de arquivos) usam sempre "/".

export const IS_WIN = window.api.platform === 'win32'
export const IS_MAC = window.api.platform === 'darwin'

export const SYSTEM_NAME = IS_WIN ? 'Windows' : 'macOS'
export const FILE_MANAGER = IS_WIN ? 'Explorador de Arquivos' : 'Finder'
// O app de configurações do sistema: Ajustes do Sistema no Mac, Configurações no Windows.
export const SYSTEM_SETTINGS = IS_WIN ? 'Configurações' : 'Ajustes'
// "O Claude Code deste Mac", "deste computador".
export const THIS_COMPUTER = IS_WIN ? 'deste computador' : 'deste Mac'

// Tecla dos atalhos: ⌘ no Mac, Ctrl no Windows.
export const isMod = (e: { metaKey: boolean; ctrlKey: boolean }) => (IS_MAC ? e.metaKey : e.ctrlKey)

const MODIFIERS: Record<string, string> = { '⌘': 'Ctrl', '⌃': 'Ctrl', '⌥': 'Alt', '⇧': 'Shift' }
const ORDER = ['Ctrl', 'Alt', 'Shift']
const NAMES: Record<string, string> = { '⌫': 'Backspace', '↩': 'Enter', '−': '-' }

// Atalho escrito como no Mac ("⌘S", "⇧⌘Z", "⌘ ,") do jeito do sistema. No Windows: "Ctrl+S",
// "Ctrl+Shift+Z", "Ctrl+,".
export function keys(mac: string): string {
  if (IS_MAC) return mac
  let rest = mac.replace(/\s+/g, '')
  const mods = new Set<string>()
  while (rest && MODIFIERS[rest[0]]) {
    mods.add(MODIFIERS[rest[0]])
    rest = rest.slice(1)
  }
  return [...ORDER.filter((m) => mods.has(m)), NAMES[rest] ?? rest].join('+')
}

// --- Caminhos ---

const SEP = IS_WIN ? '\\' : '/'
const SEPARATORS = IS_WIN ? /[\\/]/ : /\//

// O Claude no Windows às vezes escreve no formato do Git Bash ("/c/Users/ana"): volta para "C:\Users\ana".
function fromGitBash(path: string): string {
  const m = IS_WIN ? /^\/([a-zA-Z])(\/.*)?$/.exec(path) : null
  return m ? `${m[1].toUpperCase()}:${(m[2] ?? '/').replace(/\//g, '\\')}` : path
}

export function isAbsolutePath(path: string): boolean {
  if (!IS_WIN) return path.startsWith('/')
  return /^([a-zA-Z]:[\\/]|[\\/]{2})/.test(path) || /^\/[a-zA-Z](\/|$)/.test(path)
}

// Nome da pasta ou do arquivo no fim do caminho.
export function baseName(path: string): string {
  return path.split(SEPARATORS).filter(Boolean).pop() ?? path
}

// Posição do último separador (-1 sem nenhum).
export function lastSep(path: string): number {
  return IS_WIN ? Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/')) : path.lastIndexOf('/')
}

// Pasta de cima ("" sem nenhuma).
export function parentDir(path: string): string {
  const i = lastSep(path)
  return i >= 0 ? path.slice(0, i) : ''
}

// No Windows, com uma barra só ("C:/proj" e "C:\proj" são o mesmo caminho).
const normalize = (path: string) => (IS_WIN ? fromGitBash(path).replace(/\//g, '\\') : path)

// Caminho relativo à pasta, com "/" (o formato da árvore de arquivos), ou null se estiver fora.
// No Windows, sem diferenciar maiúsculas, como o disco de lá.
export function relativeTo(path: string, dir: string): string | null {
  const full = normalize(path)
  const base = normalize(dir).replace(/[\\/]+$/, '')
  const head = full.slice(0, base.length)
  if (IS_WIN ? head.toLowerCase() !== base.toLowerCase() : head !== base) return null
  if (full.length === base.length) return ''
  if (!SEPARATORS.test(full[base.length])) return null
  const rel = full.slice(base.length + 1)
  return IS_WIN ? rel.replace(/\\/g, '/') : rel
}

// "~/proj" no lugar de "/Users/ana/proj" (no Windows, "~\proj").
export function tildify(path: string): string {
  const home = window.api.homeDir
  const rel = relativeTo(path, home)
  if (rel === null) return path
  return rel ? `~${SEP}${IS_WIN ? rel.replace(/\//g, '\\') : rel}` : '~'
}

// O contrário: "~/proj" (ou "~\proj") de volta ao caminho completo, com as barras do sistema.
export function untildify(path: string): string {
  const home = window.api.homeDir
  if (path === '~') return home
  if (path.startsWith('~/') || (IS_WIN && path.startsWith('~\\'))) return normalize(home + SEP + path.slice(2))
  return normalize(path)
}
