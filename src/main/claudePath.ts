import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { findInPath, IS_WIN } from './platform'

// App aberto pelo Finder não herda o PATH do terminal; procura nos lugares comuns.
const MAC_CANDIDATES = [
  join(homedir(), '.local/bin/claude'),
  join(homedir(), '.claude/local/claude'),
  '/opt/homebrew/bin/claude',
  '/usr/local/bin/claude'
]

// Instalado pelo npm, o Windows tem só o claude.cmd, que nem o SDK nem o terminal conseguem abrir
// direto (o Windows só roda .cmd por um shell). Vale o arquivo para onde ele aponta: o cli.js do
// pacote, rodado pelo node, ou o executável.
function cmdTarget(cmd: string): string | null {
  let text: string
  try {
    text = readFileSync(cmd, 'utf8')
  } catch {
    return null
  }
  const targets = [...text.matchAll(/%~?dp0%?\\([^"%\r\n]+)/gi)].map((m) => join(dirname(cmd), m[1].trim()))
  return (
    targets.find((t) => /\.[cm]?js$/i.test(t) && existsSync(t)) ??
    targets.find((t) => /\.exe$/i.test(t) && !/(^|\\)node\.exe$/i.test(t) && existsSync(t)) ??
    null
  )
}

// O instalador oficial do Windows põe o claude.exe em ~/.local/bin.
function windowsClaude(): string {
  const local = join(homedir(), '.local', 'bin', 'claude.exe')
  if (existsSync(local)) return local
  const exe = findInPath('claude')
  if (exe) return exe
  const cmd = findInPath('claude', ['.cmd'])
  return (cmd && cmdTarget(cmd)) || 'claude.exe'
}

// Caminho do `claude`, como o SDK recebe (.exe, binário ou o cli.js do pacote do npm).
export function claudePath(): string {
  if (IS_WIN) return windowsClaude()
  return MAC_CANDIDATES.find((p) => existsSync(p)) ?? 'claude'
}

// O `claude` existe de verdade? Sem achar, claudePath devolve só o nome, na esperança do PATH.
export function claudeFound(): boolean {
  const claude = claudePath()
  return isAbsolute(claude) ? existsSync(claude) : !!findInPath(claude.replace(/\.exe$/i, ''))
}

// Programa e argumentos para abrir o `claude` fora do SDK (terminal, login, uso). O cli.js do npm
// roda pelo node, como o claude.cmd faria.
export function claudeCommand(args: string[], claude = claudePath()): { file: string; args: string[] } {
  if (/\.[cm]?js$/i.test(claude)) return { file: findInPath('node') ?? 'node', args: [claude, ...args] }
  return { file: claude, args }
}
