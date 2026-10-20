import { homedir } from 'node:os'
import { dirname } from 'node:path'
import type { Options } from '@anthropic-ai/claude-agent-sdk'
import { applyAccount } from '../accounts'
import { claudeCommand, claudeHeld, claudePath, claudeReady } from '../claudePath'
import { expandHome } from '../paths'
import { childEnv, prependPath } from '../platform'
import { distroFor, distroInfo, toLinux } from '../wsl'
import { wslLaunch, wslSdkProcess } from '../wsl/launch'
import { heldProcess } from './heldProcess'

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
    // Com o claude.exe sendo trocado (Windows), o processo espera a troca (ver claudePath/hold.ts).
    return { pathToClaudeCodeExecutable: claude, env: claudeEnv(claude, account), ...(claudeHeld() && { spawnClaudeCodeProcess: heldProcess }) }
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
// configurações e MCPs. folders: as pastas do workspace, como pastas adicionais, cada uma com o
// CLAUDE.md dela (ver workspaces.ts).
export function claudeCodeOptions(
  cwd: string,
  account?: string,
  folders: string[] = []
): Pick<Options, 'cwd' | 'pathToClaudeCodeExecutable' | 'env' | 'systemPrompt' | 'spawnClaudeCodeProcess' | 'additionalDirectories'> {
  const full = expandHome(cwd)
  const proc = claudeProcess(account, full)
  // Rodando no WSL, o `claude` do Linux só entende os caminhos de lá (C:\ vira /mnt/c).
  const inWsl = !!distroFor(full)
  const dirs = folders.map((f) => (inWsl ? toLinux(expandHome(f)) : expandHome(f)))
  const env: Record<string, string | undefined> = { ...proc.env, [ARTIFACT]: proc.env?.[ARTIFACT] ?? '1' }
  if (dirs.length > 0) env[FOLDERS_CLAUDE_MD] = '1'
  return {
    cwd: full,
    ...proc,
    env,
    systemPrompt: { type: 'preset', preset: 'claude_code' },
    ...(dirs.length > 0 && { additionalDirectories: dirs })
  }
}

// A ferramenta de artefatos (publicar uma página no claude.ai) vem desligada quando o Claude Code roda
// pelo SDK, e não no terminal; esta variável liga como no terminal. Quem desligou por conta própria
// (a variável no ambiente ou enableArtifact: false nas configurações) continua com ela desligada.
const ARTIFACT = 'CLAUDE_CODE_ARTIFACT'

// Opção do Claude Code que liga a leitura do CLAUDE.md das pastas adicionais (o nome existe no
// binário da 2.1; sem ela, só o CLAUDE.md da pasta onde ele abre).
export const FOLDERS_CLAUDE_MD = 'CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD'

export type ClaudeLaunch =
  | { ok: true; file: string; args: string[]; env: Record<string, string>; cwd: string }
  | { ok: false; error: string }

// Programa, argumentos, ambiente e pasta para abrir o `claude` fora do SDK (conferência de login,
// limites de uso). No WSL, pelo wsl.exe; espera a distro responder na primeira vez.
export async function claudeLaunch(args: string[], account?: string, cwd?: string): Promise<ClaudeLaunch> {
  const distro = distroFor(cwd)
  if (distro) return wslLaunch(distro, { args, account, cwd })
  await claudeReady()
  const claude = claudePath()
  const cmd = claudeCommand(args, claude)
  return { ok: true, ...cmd, env: claudeEnv(claude, account), cwd: cwd ? expandHome(cwd) : homedir() }
}
