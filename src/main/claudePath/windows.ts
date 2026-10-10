import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { findInPath } from '../platform'

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
export function windowsClaude(): string {
  const local = join(homedir(), '.local', 'bin', 'claude.exe')
  if (existsSync(local)) return local
  const exe = findInPath('claude')
  if (exe) return exe
  const cmd = findInPath('claude', ['.cmd'])
  return (cmd && cmdTarget(cmd)) || 'claude.exe'
}
