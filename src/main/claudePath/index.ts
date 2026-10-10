import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { findInPath, IS_WIN } from '../platform'
import { knownClaude, loginShellClaude, lookupLoginShell } from './mac'
import { windowsClaude } from './windows'

// Caminho do `claude`, como o SDK recebe (.exe, binário ou o cli.js do pacote do npm).
export function claudePath(): string {
  if (IS_WIN) return windowsClaude()
  return knownClaude() ?? loginShellClaude() ?? 'claude'
}

// Mac: procura também pelo PATH do shell de login, quando o `claude` não está em nenhum lugar
// conhecido. Em segundo plano (o shell leva de meio a alguns segundos para abrir); quem precisa
// saber se ele existe espera isto antes de perguntar (ver auth/index.ts).
export function lookupClaude(): Promise<void> {
  if (IS_WIN || knownClaude()) return Promise.resolve()
  return lookupLoginShell()
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
