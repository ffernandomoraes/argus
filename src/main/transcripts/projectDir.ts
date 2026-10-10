import { readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { expandHome } from '../paths'
import { IS_MAC, IS_WIN } from '../platform'
import { cwdsIn } from './cwd'
import { readSliceSync } from './read'

// O Claude Code grava cada conversa num .jsonl dentro de uma pasta com o caminho do
// projeto "achatado": tudo que não é letra ou número vira "-".
const flatten = (path: string) => path.replace(/[^a-zA-Z0-9]/g, '-')

export const projectsDir = () => join(homedir(), '.claude', 'projects')

// Id de conversa (nome do .jsonl) vindo da tela: nada de "../".
export const isSessionId = (id: unknown): id is string => typeof id === 'string' && /^[\w-]+$/.test(id)

// No Mac o Claude Code normaliza o caminho (NFC) antes de achatar: "Área" pode vir decomposto do
// sistema de arquivos e daria outro nome.
const nfc = (path: string) => (IS_MAC ? path.normalize('NFC') : path)
// No Windows o nome da pasta vale sem diferença de maiúsculas, como o próprio caminho.
const fold = (name: string) => (IS_WIN ? name.toLowerCase() : name)

// Acima de 200 caracteres o nome fica nos 200 primeiros mais "-" e um hash do caminho (função que
// monta o nome da pasta do projeto no sdk.mjs do @anthropic-ai/claude-agent-sdk). Comum no
// Windows com o OneDrive, que alonga os caminhos.
const MAX_NAME = 200

function pathHash(path: string): string {
  let h = 0
  for (let i = 0; i < path.length; i++) h = ((h << 5) - h + path.charCodeAt(i)) | 0
  return Math.abs(h).toString(36)
}

// Como o cwd do processo: sem barra no fim nem "..". Só caminho absoluto (relativo dependeria da
// pasta atual do app).
const canonical = (path: string) => {
  const full = expandHome(path)
  return nfc(isAbsolute(full) ? resolve(full) : full)
}

// Pasta das conversas de um projeto. Caminho comprido: o hash pode mudar entre versões do Claude
// Code, então, como o SDK faz, procura a pasta pelo começo do nome e confere o `cwd` gravado.
export function projectDir(projectPath: string): string {
  const full = canonical(projectPath)
  const name = flatten(full)
  return name.length <= MAX_NAME ? join(projectsDir(), name) : longProjectDir(full, name)
}

// Arquivo de uma conversa; nulo com id inválido.
export function sessionFile(projectPath: string, sessionId: unknown): string | null {
  return isSessionId(sessionId) ? join(projectDir(projectPath), `${sessionId}.jsonl`) : null
}

// A pasta `dirName` (só o nome) é a das conversas feitas em `cwd`? Nome comprido: basta o começo,
// porque o hash do fim pode ter mudado de versão.
export function dirHoldsCwd(dirName: string, cwd: string): boolean {
  const name = fold(flatten(nfc(cwd)))
  const dir = fold(dirName)
  return name.length <= MAX_NAME ? dir === name : dir.startsWith(name.slice(0, MAX_NAME) + '-')
}

// Resultado da procura, válido enquanto ~/.claude/projects não ganha nem perde pasta (a data dela
// muda). Sem achar, vale por pouco tempo: a pasta pode existir antes da primeira conversa gravada.
type Found = { dir: string; stamp: number; until: number }
const MISS_MS = 30_000
const longDirs = new Map<string, Found>()

function longProjectDir(full: string, name: string): string {
  const root = projectsDir()
  const stamp = mtimeOf(root)
  const now = Date.now()
  const hit = longDirs.get(full)
  if (hit && hit.stamp === stamp && now < hit.until) return hit.dir
  const expected = join(root, `${name.slice(0, MAX_NAME)}-${pathHash(full)}`)
  const found = isDir(expected) ? expected : searchByPrefix(root, name)
  longDirs.set(full, { dir: found ?? expected, stamp, until: found ? Infinity : now + MISS_MS })
  return found ?? expected
}

function mtimeOf(path: string): number {
  try {
    return statSync(path).mtimeMs
  } catch {
    return 0
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

// Pastas com o mesmo começo de nome; vale a que tem conversa feita no caminho.
function searchByPrefix(root: string, name: string): string | null {
  const prefix = fold(name.slice(0, MAX_NAME) + '-')
  for (const dirName of subdirs(root)) {
    if (!fold(dirName).startsWith(prefix)) continue
    const dir = join(root, dirName)
    if (holdsProject(dir, name)) return dir
  }
  return null
}

function subdirs(root: string): string[] {
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    return []
  }
}

// O `cwd` vem nas primeiras linhas; poucos arquivos bastam (todos são do mesmo projeto).
const PROBE_FILES = 5
const PROBE_BYTES = 1024 * 1024

function holdsProject(dir: string, name: string): boolean {
  let files: string[]
  try {
    files = readdirSync(dir).filter((n) => n.endsWith('.jsonl')).slice(0, PROBE_FILES)
  } catch {
    return false
  }
  for (const file of files) {
    let text: string
    try {
      text = readSliceSync(join(dir, file), 0, PROBE_BYTES)
    } catch {
      continue
    }
    for (const cwd of cwdsIn(text)) if (fold(flatten(nfc(cwd))) === fold(name)) return true
  }
  return false
}
