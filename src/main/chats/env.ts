import { homedir } from 'node:os'
import { dirname } from 'node:path'
import type { Options } from '@anthropic-ai/claude-agent-sdk'
import { applyAccount } from '../accounts'
import { claudeCommand, claudePath } from '../claudePath'
import { expandHome } from '../paths'
import { childEnv, prependPath } from '../platform'
import { distroFor, distroInfo } from '../wsl'
import { wslLaunch, wslSdkProcess } from '../wsl/launch'

// O app aberto pelo Finder não herda o PATH do terminal, e as variáveis do Electron
// fariam o `claude` subir como Node puro. A conta escolhe a pasta de configuração; sem ela,
// vale a padrão (ver accounts/).
export function claudeEnv(claude: string, account?: string): Record<string, string> {
  const env = childEnv()
  prependPath(env, [dirname(claude)])
  applyAccount(env, account)
  return env
}

type ProcessOptions = Pick<Options, 'pathToClaudeCodeExecutable' | 'env' | 'spawnClaudeCodeProcess'>

// Onde está o `claude` e com que ambiente ele sobe: o que toda sessão do SDK precisa. `cwd`: a
// pasta do projeto, que decide se ele roda no WSL (ver wsl/index.ts); sem ela, o do app.
export function claudeProcess(account?: string, cwd?: string): ProcessOptions {
  const distro = distroFor(cwd)
  if (!distro) {
    const claude = claudePath()
    return { pathToClaudeCodeExecutable: claude, env: claudeEnv(claude, account) }
  }
  // No WSL o processo abre pelo wsl.exe, com o `claude` do Linux; o caminho aqui só diz ao SDK
  // que é um executável (e não um .js para rodar pelo node).
  return {
    pathToClaudeCodeExecutable: distroInfo(distro)?.claude ?? 'claude',
    env: childEnv(),
    spawnClaudeCodeProcess: (o) => wslSdkProcess(distro, { args: o.args, env: o.env, cwd }, account)
  }
}

// Sessão como a do Claude Code no terminal, na pasta do projeto: mesmo prompt, CLAUDE.md,
// configurações e MCPs.
export function claudeCodeOptions(
  cwd: string,
  account?: string
): Pick<Options, 'cwd' | 'pathToClaudeCodeExecutable' | 'env' | 'systemPrompt' | 'spawnClaudeCodeProcess'> {
  const full = expandHome(cwd)
  return { cwd: full, ...claudeProcess(account, full), systemPrompt: { type: 'preset', preset: 'claude_code' } }
}

export type ClaudeLaunch =
  | { ok: true; file: string; args: string[]; env: Record<string, string>; cwd: string }
  | { ok: false; error: string }

// Programa, argumentos, ambiente e pasta para abrir o `claude` fora do SDK (conferência de login,
// limites de uso). No WSL, pelo wsl.exe; espera a distro responder na primeira vez.
export async function claudeLaunch(args: string[], account?: string, cwd?: string): Promise<ClaudeLaunch> {
  const distro = distroFor(cwd)
  if (distro) return wslLaunch(distro, { args, account, cwd })
  const claude = claudePath()
  const cmd = claudeCommand(args, claude)
  return { ok: true, ...cmd, env: claudeEnv(claude, account), cwd: cwd ? expandHome(cwd) : homedir() }
}
