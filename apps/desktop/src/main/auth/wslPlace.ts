import { access } from 'node:fs/promises';
import { claudeDistros } from '../claudeHome';
import { distroFor, distroInfo, homeUnc, knownDistros, sameDistro, toUnc } from '../wsl';
import { wslAccountDir } from '../wsl/accounts';
import { sharedLoginHome } from '../wsl/sharedLogin';
import { readAccount, type AccountRead } from './status';

// O login de cada conta dentro das distros do WSL. No Windows com o `claude.exe` instalado, o
// `claude` do app (login, status e uso das contas) é o do Windows, mas a conversa de uma pasta do
// WSL roda com o `claude` e o login de lá (ver wsl/index.ts). Sem olhar esse login, a conta aparecia
// conectada nas Configurações e a conversa respondia "Not logged in", sem ter onde entrar pelo app
// (relato de 2026-11-11).
// Desde a 0.1.125, quando dá, o `claude` de lá usa o próprio login do Windows (ver
// wsl/sharedLogin.ts): a distro deixa de ter login à parte, e nada daqui vale para ela.

// Distros com o Claude Code que não são o lugar onde roda o `claude` do app e não usam o login
// dele: o login delas é outro.
export function otherDistros(): string[] {
  const own = distroFor();
  return claudeDistros().filter((d) => (!own || !sameDistro(d, own)) && !sharedLoginHome(d));
}

// A distro pedida pela tela, se o login dela é mesmo outro (não é a do `claude` do app nem usa o
// login dele). Com o nome como o WSL escreve, quando o app conhece a distro.
export function loginDistro(distro?: string): string | undefined {
  if (!distro) return undefined;
  const own = distroFor();
  if ((own && sameDistro(distro, own)) || sharedLoginHome(distro)) return undefined;
  return knownDistros().find((d) => sameDistro(d, distro)) ?? distro;
}

// Uma pasta da distro (a do usuário), que faz o `claude` abrir lá dentro (ver claudeLaunch).
export const wslPlace = (distro: string): string => homeUnc(distro) ?? toUnc(distro, '/');

// Login da conta na distro. A conta extra que nunca rodou lá não tem pasta: está sem login, e a
// conferência não cria a pasta só para perguntar (o `claude` de lá criaria, ver prepareWslAccount).
export async function readWslAccount(distro: string, id: string): Promise<AccountRead> {
  const info = distroInfo(distro);
  if (!info) return { ok: false };
  const dir = wslAccountDir(info, id);
  if (dir) {
    const missing = await access(toUnc(distro, dir)).then(
      () => false,
      (err: NodeJS.ErrnoException) => err.code === 'ENOENT',
    );
    if (missing) return { ok: true, account: { loggedIn: false } };
  }
  return readAccount(id, wslPlace(distro));
}
