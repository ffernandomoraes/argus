import { homedir } from 'node:os'
import { resolveAccount } from '../accounts'
import { tr } from '../i18n'
import { childEnv } from '../platform'
import { prepareWslAccount, wslAccountDir } from './accounts'
import { ensureDistro, WSL_EXE, type DistroInfo } from './distros'
import { installInWsl, watchInstall, WSL_INSTALL } from './install'
import { log } from './log'
import { toLinux } from './path'
import { deferredWslProcess, linuxEnv, wslCommand } from './run'

// Como abrir o `claude` (ou um shell) dentro de uma distro: para o terminal, as conferências de
// login e uso, e o SDK.

export type WslLaunch = { ok: true; file: string; args: string[]; env: Record<string, string>; cwd: string; account: string } | { ok: false; error: string }

// Pasta da conta, no formato do Linux; a principal vai sem a variável.
async function accountEnv(distro: string, info: DistroInfo, account: string): Promise<Record<string, string>> {
  await prepareWslAccount(distro, info, account)
  const dir = wslAccountDir(info, account)
  return dir ? { CLAUDE_CONFIG_DIR: dir } : {}
}

// Pasta de trabalho no Linux; sem pasta (login, uso), a do usuário.
const linuxCwd = (info: DistroInfo, cwd?: string) => (cwd ? toLinux(cwd) : info.home)

// visibleInstall: sem o Claude Code na distro, o terminal instala à vista e abre o `claude` em seguida;
// sem ele (conferências de login e uso), instala em segundo plano antes de abrir.
export async function wslLaunch(
  distro: string,
  req: { args?: string[]; shell?: boolean; account?: string; cwd?: string; env?: Record<string, string>; visibleInstall?: boolean }
): Promise<WslLaunch> {
  let info = await ensureDistro(distro)
  if (!info)
    return {
      ok: false,
      error: tr(
        `Não deu para abrir o WSL (${distro}). Confira se ele está instalado e funcionando.`,
        `Couldn’t open WSL (${distro}). Check that it’s installed and working.`
      )
    }
  const account = resolveAccount(req.account)
  const cwd = linuxCwd(info, req.cwd)
  // O processo do Windows (o wsl.exe) fica na pasta do usuário do Windows: o cmd e o node-pty não
  // aceitam pasta de rede como pasta de trabalho. A do Linux vai pelo --cd.
  const base = { env: childEnv(), cwd: homedir(), account }
  // Shell: o padrão da pessoa no Linux, de login, como o terminal do Ubuntu abre.
  if (req.shell) return { ok: true, file: WSL_EXE, args: ['-d', distro, '--cd', cwd], ...base }
  if (!info.claude && !req.visibleInstall) info = (await installInWsl(distro)) ?? info
  try {
    const env = { ...linuxEnv(req.env ?? {}), ...(await accountEnv(distro, info, account)) }
    let argv = info.claude ? [info.claude, ...(req.args ?? [])] : null
    if (!argv && req.visibleInstall) {
      // Instala no próprio terminal, com a saída à vista, e abre o `claude` recém-instalado.
      const installing = tr(`Instalando o Claude Code no WSL (${distro})...`, `Installing Claude Code in WSL (${distro})...`)
      const script = `echo '${installing}'; set -o pipefail; ${WSL_INSTALL} && exec "$HOME/.local/bin/claude" "$@"`
      argv = ['bash', '-c', script, 'claude', ...(req.args ?? [])]
      watchInstall(distro)
    }
    if (!argv)
      return {
        ok: false,
        error: tr(
          `Não deu para instalar o Claude Code no WSL (${distro}). Veja o diagnóstico nas configurações.`,
          `Couldn’t install Claude Code in WSL (${distro}). See the diagnostics in Settings.`
        )
      }
    const cmd = wslCommand(distro, info, cwd, argv, env)
    return { ok: true, ...cmd, ...base }
  } catch (err) {
    log(`não deu para preparar o claude no WSL (${distro})`, (err as Error).message)
    return {
      ok: false,
      error: tr(`Não deu para preparar o WSL (${distro}): ${(err as Error).message}`, `Couldn’t prepare WSL (${distro}): ${(err as Error).message}`)
    }
  }
}

// Processo do SDK dentro da distro (ver spawnClaudeCodeProcess em chats/env.ts).
export function wslSdkProcess(
  distro: string,
  o: { args: string[]; env: Record<string, string | undefined>; cwd?: string },
  account: string | undefined
) {
  return deferredWslProcess(distro, async (info) => ({
    argv: [info.claude ?? 'claude', ...o.args],
    env: { ...linuxEnv(o.env), ...(await accountEnv(distro, info, resolveAccount(account))) },
    cwd: linuxCwd(info, o.cwd)
  }))
}
