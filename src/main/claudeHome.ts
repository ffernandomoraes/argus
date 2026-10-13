import { homedir } from 'node:os'
import { join } from 'node:path'
import { accountDir, accountIds } from './accounts'
import { distroFor, distroInfo, homeUnc, knownDistros, toLinux, toUnc } from './wsl'
import { wslAccountDir, wslStatusDirs } from './wsl/accounts'

// Onde o Claude Code guarda os dados (conversas, status, CLAUDE.md, agentes), vista pelo app. No
// Mac e no Windows, a pasta do usuário. Num projeto do WSL, a pasta do usuário no Linux daquela
// distro (\\wsl.localhost\<distro>\home\<usuário>), porque é o `claude` de lá que grava.

// Pasta do usuário de quem roda o Claude Code de `path` (sem ela, o do app).
export function userHome(path?: string): string {
  const distro = distroFor(path)
  if (!distro) return homedir()
  return homeUnc(distro, path ? toLinux(path) : undefined) ?? homedir()
}

// ~/.claude de quem roda o Claude Code de `path`.
export const claudeDir = (path?: string): string => join(userHome(path), '.claude')

// Pasta onde está o .claude.json da conta: a dela, ou a do usuário na principal.
export function claudeJsonDir(account: string, path?: string): string {
  const distro = distroFor(path)
  const info = distro ? distroInfo(distro) : null
  if (distro && info) {
    const dir = wslAccountDir(info, account)
    return dir ? toUnc(distro, dir) : userHome(path)
  }
  return accountDir(account) ?? homedir()
}

// Pasta de configuração da conta (CLAUDE_CONFIG_DIR), onde fica o .credentials.json no Windows e
// no Linux: a dela, ou o ~/.claude na principal.
export function configDir(account: string, path?: string): string {
  const distro = distroFor(path)
  const info = distro ? distroInfo(distro) : null
  if (distro && info) {
    const dir = wslAccountDir(info, account)
    return dir ? toUnc(distro, dir) : claudeDir(path)
  }
  return accountDir(account) ?? join(homedir(), '.claude')
}

// Distros com o Claude Code instalado, que o app acompanha junto com o do próprio sistema.
export function claudeDistros(): string[] {
  return knownDistros().filter((d) => distroInfo(d)?.claude)
}

export type StatusDir = { dir: string; distro?: string }

// Pastas onde cada Claude Code aberto grava o status (<pasta>/sessions/<pid>.json), de todas as
// contas, no sistema e em cada distro. `distro`: o pid gravado é de um processo do Linux.
export function statusDirsWithPlace(): StatusDir[] {
  const ids = accountIds()
  const native = ids.map((id) => ({ dir: join(accountDir(id) ?? join(homedir(), '.claude'), 'sessions') }))
  const wsl = claudeDistros().flatMap((distro) => {
    const info = distroInfo(distro)
    return info ? wslStatusDirs(distro, info, ids).map((dir) => ({ dir, distro })) : []
  })
  return [...native, ...wsl]
}
