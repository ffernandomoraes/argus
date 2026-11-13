import { execFile } from 'node:child_process';
import { release } from 'node:os';
import { app } from 'electron';
import { claudePath, nativeClaudeFound } from '../claudePath';
import { tr } from '../i18n';
import { IS_WIN } from '../platform';
import { distroFor } from './index';
import { distroInfo, listDistros, loadDistro, WSL_EXE } from './distros';
import { logLines } from './log';
import { sharedLoginBlocker } from './sharedLogin';
import { prepareWslConfig, PORTABLE, type PortableState } from './windowsConfig';

// Texto para a pessoa copiar e mandar quando algo do WSL não funciona: versões, distros, o que o
// app achou em cada uma e o registro do que pediu ao WSL (ver log.ts).

function wslVersion(): Promise<string> {
  return new Promise((resolve) => {
    execFile(WSL_EXE, ['--version'], { encoding: 'buffer', timeout: 10_000, windowsHide: true }, (err, stdout) => {
      if (err) return resolve(tr(`(sem resposta: ${err.message})`, `(no response: ${err.message})`));
      const utf16 = stdout.length > 1 && stdout[1] === 0;
      resolve((utf16 ? stdout.toString('utf16le') : stdout.toString('utf8')).replace(/\0/g, '').trim());
    });
  });
}

// Onde o `claude` da distro acha o login das contas (ver sharedLogin.ts).
function loginLine(distro: string, winHome: string | null | undefined): string {
  const blocker = sharedLoginBlocker(distro);
  const label = tr('Login das contas', 'Account sign-in');
  if (!blocker) return `${label}: ${tr('o mesmo do Windows, em', 'same as Windows, at')} ${winHome}`;
  const why = {
    own: tr('o Claude do app roda no WSL', 'the app’s Claude runs in WSL'),
    off: tr('desligado nas configurações', 'turned off in settings'),
    vault: tr('o Windows guarda o login no cofre de credenciais', 'Windows keeps the sign-in in the credential vault'),
    unmounted: tr('a pasta do usuário do Windows não está acessível de dentro da distro', 'the Windows user folder is not reachable from inside the distro'),
    unknown: tr('a distro ainda não respondeu onde fica a pasta do Windows', 'the distro has not answered where the Windows folder is yet'),
  }[blocker];
  return `${label}: ${tr('separado', 'separate')} (${why})`;
}

// De onde vêm as instruções globais, skills, agents, comandos e estilos nas pastas da distro (ver
// windowsConfig.ts). Confere como a próxima conversa conferiria: os links que faltarem entram.
async function configLine(distro: string): Promise<string> {
  const label = tr('Configurações', 'Settings');
  const config = await prepareWslConfig(distro);
  if (!config) return `${label}: ${tr('as do Linux (sem as do Windows nesta distro)', 'the Linux ones (no Windows settings in this distro)')}`;
  const name: Record<PortableState, string> = {
    windows: tr('do Windows', 'from Windows'),
    own: tr('do Linux', 'from Linux'),
    none: tr('nenhum', 'none'),
    failed: tr('falhou', 'failed'),
  };
  return `${label}: ${PORTABLE.map((p) => `${p} ${name[config[p]]}`).join(', ')}`;
}

export async function wslDiagnostics(): Promise<string> {
  if (!IS_WIN) return tr('O WSL só existe no Windows.', 'WSL is only available on Windows.');
  const distros = await listDistros();
  await Promise.all(distros.map((d) => loadDistro(d)));
  const configs = new Map(await Promise.all(distros.map(async (d) => [d, await configLine(d)] as const)));
  const missing = tr('não instalado', 'not installed');
  const lines = [
    `Argus ${app.getVersion()} - Windows ${release()}`,
    tr('Claude Code do Windows', 'Windows Claude Code') + `: ${nativeClaudeFound() ? claudePath() : missing}`,
    tr('Claude do app roda em', 'App’s Claude runs in') + `: ${distroFor() ? `WSL (${distroFor()})` : 'Windows'}`,
    '',
    '== wsl --version',
    await wslVersion(),
    '',
    '== Distros',
    ...(distros.length ? distros : [tr('(nenhuma)', '(none)')]).map((d) => {
      const info = distroInfo(d);
      if (!info) return `${d}: ${tr('sem resposta', 'no response')}`;
      return `${d}: home=${info.home} claude=${info.claude ?? missing}\n  PATH=${info.path}\n  ${loginLine(d, info.winHome)}\n  ${configs.get(d)}`;
    }),
    '',
    tr('== Registro', '== Log'),
    ...logLines(),
  ];
  return lines.join('\n');
}
