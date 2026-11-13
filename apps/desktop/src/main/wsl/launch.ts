import { homedir } from 'node:os';
import { dropLoginOverrides, overridesLogin, resolveAccount } from '../accounts';
import { tr } from '../i18n';
import { childEnv } from '../platform';
import { prepareWslAccount, wslAccountDir } from './accounts';
import { ensureDistro, WSL_EXE, type DistroInfo } from './distros';
import { installInWsl, watchInstall, WSL_INSTALL } from './install';
import { log } from './log';
import { toLinux } from './path';
import { deferredWslProcess, linuxEnv, wslCommand } from './run';
import { alignWslIdentity, sharedLoginDir, windowsHomeReady } from './sharedLogin';
import { prepareWslConfig } from './windowsConfig';

// Como abrir o `claude` (ou um shell) dentro de uma distro: para o terminal, as conferências de
// login e uso, e o SDK.

export type WslLaunch = { ok: true; file: string; args: string[]; env: Record<string, string>; cwd: string; account: string } | { ok: false; error: string };

// Pasta da conta, no formato do Linux; a principal vai sem a variável. Com o login compartilhado, o
// lugar do login vai à parte: a pasta da conta no Windows, vista de lá (ver sharedLogin.ts). Antes,
// as configurações do Windows entram no ~/.claude de lá (ver windowsConfig.ts): a pasta de uma conta
// extra liga as suas às da principal.
async function accountEnv(distro: string, info: DistroInfo, account: string): Promise<Record<string, string>> {
  await windowsHomeReady(distro);
  await prepareWslConfig(distro);
  await prepareWslAccount(distro, info, account);
  const dir = wslAccountDir(info, account);
  const login = sharedLoginDir(distro, account);
  if (login) await alignWslIdentity(distro, info, account);
  return { ...(dir && { CLAUDE_CONFIG_DIR: dir }), ...(login && { CLAUDE_SECURESTORAGE_CONFIG_DIR: login }) };
}

// Variáveis da conta, que só valem dentro do Linux (ver accountEnv).
const isAccountVar = (name: string) => /^(CLAUDE_CONFIG_DIR|CLAUDE_SECURESTORAGE_CONFIG_DIR)$/i.test(name);

// Ambiente do wsl.exe que abre o shell de uma pasta do WSL. O wsl.exe só passa para o Linux as
// variáveis listadas em WSLENV: as da conta vão com /u (só do Windows para o Linux; um programa do
// Windows aberto desse shell não recebe um caminho do Linux) e sem /p (o caminho já é o de lá).
// Assim o `claude` digitado nele entra com a conta do grupo, como no shell do Windows (ver
// nativeTerminal). Até a 0.1.124 ia sem nada, e ele usava o login próprio do Linux, que podia ser
// de outra conta. Da lista que a pessoa já tenha em WSLENV, saem as variáveis da conta (a principal
// vai sem elas, como no Windows) e, numa conta extra, as que trocariam o login dela.
export function wslShellEnv(base: Record<string, string>, account: string, vars: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  let listed: string[] = [];
  for (const [key, value] of Object.entries(base)) {
    if (/^wslenv$/i.test(key)) listed = value.split(':');
    else if (!isAccountVar(key) && !overridesLogin(key, account)) env[key] = value;
  }
  const kept = listed.filter((entry) => {
    const name = entry.split('/')[0];
    return !!name && !isAccountVar(name) && !overridesLogin(name, account);
  });
  const all = [...kept, ...Object.keys(vars).map((name) => `${name}/u`)];
  return { ...env, ...vars, ...(all.length > 0 && { WSLENV: all.join(':') }) };
}

// Pasta de trabalho no Linux; sem pasta (login, uso), a do usuário.
const linuxCwd = (info: DistroInfo, cwd?: string) => (cwd ? toLinux(cwd) : info.home);

// visibleInstall: sem o Claude Code na distro, o terminal instala à vista e abre o `claude` em seguida;
// sem ele (conferências de login e uso), instala em segundo plano antes de abrir.
export async function wslLaunch(
  distro: string,
  req: { args?: string[]; shell?: boolean; account?: string; cwd?: string; env?: Record<string, string>; visibleInstall?: boolean },
): Promise<WslLaunch> {
  let info = await ensureDistro(distro);
  if (!info)
    return {
      ok: false,
      error: tr(
        `Não deu para abrir o WSL (${distro}). Confira se ele está instalado e funcionando.`,
        `Couldn’t open WSL (${distro}). Check that it’s installed and working.`,
      ),
    };
  const account = resolveAccount(req.account);
  const cwd = linuxCwd(info, req.cwd);
  // O processo do Windows (o wsl.exe) fica na pasta do usuário do Windows: o cmd e o node-pty não
  // aceitam pasta de rede como pasta de trabalho. A do Linux vai pelo --cd.
  const base = { env: childEnv(), cwd: homedir(), account };
  // Shell: o padrão da pessoa no Linux, de login, como o terminal do Ubuntu abre, com a conta do
  // grupo (ver wslShellEnv).
  if (req.shell) {
    try {
      const env = wslShellEnv(base.env, account, await accountEnv(distro, info, account));
      return { ok: true, file: WSL_EXE, args: ['-d', distro, '--cd', cwd], ...base, env };
    } catch (err) {
      log(`não deu para preparar o shell no WSL (${distro})`, (err as Error).message);
      return {
        ok: false,
        error: tr(`Não deu para preparar o WSL (${distro}): ${(err as Error).message}`, `Couldn’t prepare WSL (${distro}): ${(err as Error).message}`),
      };
    }
  }
  if (!info.claude && !req.visibleInstall) info = (await installInWsl(distro)) ?? info;
  try {
    const env = { ...linuxEnv(req.env ?? {}), ...(await accountEnv(distro, info, account)) };
    let argv = info.claude ? [info.claude, ...(req.args ?? [])] : null;
    if (!argv && req.visibleInstall) {
      // Instala no próprio terminal, com a saída à vista, e abre o `claude` recém-instalado.
      const installing = tr(`Instalando o Claude Code no WSL (${distro})...`, `Installing Claude Code in WSL (${distro})...`);
      const script = `echo '${installing}'; set -o pipefail; ${WSL_INSTALL} && exec "$HOME/.local/bin/claude" "$@"`;
      argv = ['bash', '-c', script, 'claude', ...(req.args ?? [])];
      watchInstall(distro);
    }
    if (!argv)
      return {
        ok: false,
        error: tr(
          `Não deu para instalar o Claude Code no WSL (${distro}). Veja o diagnóstico nas configurações.`,
          `Couldn’t install Claude Code in WSL (${distro}). See the diagnostics in Settings.`,
        ),
      };
    const cmd = await wslCommand(distro, info, cwd, argv, env);
    return { ok: true, ...cmd, ...base };
  } catch (err) {
    log(`não deu para preparar o claude no WSL (${distro})`, (err as Error).message);
    return {
      ok: false,
      error: tr(`Não deu para preparar o WSL (${distro}): ${(err as Error).message}`, `Couldn’t prepare WSL (${distro}): ${(err as Error).message}`),
    };
  }
}

// Processo do SDK dentro da distro (ver spawnClaudeCodeProcess em chats/env.ts).
export function wslSdkProcess(
  distro: string,
  o: { args: string[]; env: Record<string, string | undefined>; cwd?: string },
  account: string | undefined,
) {
  const id = resolveAccount(account);
  return deferredWslProcess(distro, async (info) => ({
    argv: [info.claude ?? 'claude', ...o.args],
    // O ambiente do Windows chega até aqui: o que trocaria o login da conta não passa (ver dropLoginOverrides).
    env: { ...dropLoginOverrides(linuxEnv(o.env), id), ...(await accountEnv(distro, info, id)) },
    cwd: linuxCwd(info, o.cwd),
  }));
}
