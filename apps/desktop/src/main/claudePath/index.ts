import { existsSync, realpathSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import { findAllInPath, findInPath, IS_WIN } from '../platform'
import { claudeDistro } from '../wsl/distros'
import { editorClaudes } from './editors'
import { knownClaude, knownClaudes, loginShellClaude, lookupLoginShell } from './mac'
import { windowsClaude, windowsClaudes } from './windows'

export { claudeHeld, claudeReady, holdClaude } from './hold'

// O mais novo dos `claude` achados, escolhido por claudeVersion depois de perguntar a versão de
// cada um. Até lá (e se ele sumir), vale a ordem de sempre.
let chosen: string | null = null

export function chooseClaude(path: string | null): void {
  chosen = path
}

// O primeiro achado na ordem de sempre, sem a escolha pela versão.
function firstClaude(): string {
  if (IS_WIN) return windowsClaude()
  return knownClaude() ?? loginShellClaude() ?? 'claude'
}

// Caminho do `claude`, como o SDK recebe (.exe, binário ou o cli.js do pacote do npm).
export function claudePath(): string {
  return chosen && existsSync(chosen) ? chosen : firstClaude()
}

// Todos os `claude` da máquina, sem repetir o mesmo arquivo por atalhos diferentes. Os instalados
// primeiro, na ordem de sempre (no empate de versão, ganha o primeiro); depois os das extensões
// dos editores.
export function allClaudes(): { path: string; source: 'system' | 'editor' }[] {
  const system = IS_WIN
    ? windowsClaudes()
    : [...knownClaudes(), loginShellClaude(), ...findAllInPath('claude')].filter((p): p is string => !!p)
  const seen = new Set<string>()
  const out: { path: string; source: 'system' | 'editor' }[] = []
  const add = (path: string, source: 'system' | 'editor') => {
    let real = path
    try {
      real = realpathSync(path)
    } catch {
      return
    }
    if (seen.has(real)) return
    seen.add(real)
    out.push({ path, source })
  }
  system.forEach((p) => add(p, 'system'))
  editorClaudes().forEach((p) => add(p, 'editor'))
  return out
}

// Mac: procura também pelo PATH do shell de login, quando o `claude` não está em nenhum lugar
// conhecido. Em segundo plano (o shell leva de meio a alguns segundos para abrir); quem precisa
// saber se ele existe espera isto antes de perguntar (ver auth/index.ts).
export function lookupClaude(): Promise<void> {
  if (IS_WIN || knownClaude()) return Promise.resolve()
  return lookupLoginShell()
}

// O `claude` deste sistema existe de verdade? Sem achar, claudePath devolve só o nome, na
// esperança do PATH.
export function nativeClaudeFound(): boolean {
  const claude = claudePath()
  return isAbsolute(claude) ? existsSync(claude) : !!findInPath(claude.replace(/\.exe$/i, ''))
}

// Tem um Claude Code para o app usar? No Windows, vale também o instalado no Linux do WSL: quem
// trabalha lá não precisa de um segundo, do lado do Windows (ver wsl/index.ts).
export function claudeFound(): boolean {
  return nativeClaudeFound() || (IS_WIN && !!claudeDistro())
}

// Programa e argumentos para abrir o `claude` fora do SDK (terminal, login, uso). O cli.js do npm
// roda pelo node, como o claude.cmd faria.
export function claudeCommand(args: string[], claude = claudePath()): { file: string; args: string[] } {
  if (/\.[cm]?js$/i.test(claude)) return { file: findInPath('node') ?? 'node', args: [claude, ...args] }
  return { file: claude, args }
}
