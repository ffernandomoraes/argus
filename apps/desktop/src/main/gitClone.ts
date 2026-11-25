import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { githubHttpsUrl } from '@argus/shared/accountGitHub';
import { cloneUrl } from '@argus/shared/accountWorkspaces';
import { git } from './gitBranch/git';
import { tr } from './i18n';
import { expandHome } from './paths';
import { parseWslPath } from './wsl/path';

// "Clonar…" no card de uma pasta trazida de outro computador e não achada aqui (ver
// account/workspaces.ts) e "Clonar do GitHub" na Nova pasta: o git clone do repositório dentro da
// pasta escolhida. Sem perguntar senha nenhuma (sem terminal para responder). Com o GitHub conectado
// à conta (account/github.ts), o repositório do github.com vai pelo https com a chave dela, passada
// ao git pelo ambiente: não aparece na lista de processos nem fica no .git/config. Sem a chave,
// vale o login do git deste computador; repositório privado sem nenhum dos dois falha com o motivo.

export type CloneResult = { ok: true; path: string } | { ok: false; error: string };

const CLONE_TIMEOUT_MS = 10 * 60_000;
// Nome de pasta: sem barra, sem começar com ponto ou hífen (o git leria como opção).
const NAME = /^[^\\/:*?"<>|\0-\x1f.-][^\\/:*?"<>|\0-\x1f]{0,120}$/;

function reason(err: unknown): string {
  const stderr = String((err as { stderr?: unknown }).stderr ?? '');
  if ((err as { code?: unknown }).code === 'ENOENT') return tr('O git não está instalado neste computador.', 'Git is not installed on this computer.');
  if (/could not read Username|Authentication failed|Permission denied|terminal prompts disabled|Repository not found/i.test(stderr)) {
    return tr(
      'O repositório pediu login. Conecte o GitHub em Configurações > Perfil > Conta e libere este repositório, ou entre no GitHub pelo git deste computador (gh auth login).',
      'The repository asked for a login. Connect GitHub in Settings > Profile > Account and allow this repository, or sign in to GitHub with git on this computer (gh auth login).',
    );
  }
  const last = stderr.trim().split('\n').pop()?.replace(/^fatal:\s*/, '');
  return last || (err instanceof Error ? err.message : String(err));
}

// O cabeçalho com a chave só para o github.com, pelas variáveis GIT_CONFIG_* (git 2.31+), depois das
// que já existirem no ambiente.
export function tokenEnv(token: string, env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const n = Number(env.GIT_CONFIG_COUNT) || 0;
  return {
    GIT_CONFIG_COUNT: String(n + 1),
    [`GIT_CONFIG_KEY_${n}`]: 'http.https://github.com/.extraheader',
    [`GIT_CONFIG_VALUE_${n}`]: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
  };
}

export async function cloneRepository(url: string, parent: string, name: string, token?: string | null): Promise<CloneResult> {
  // A chave não atravessa o wsl.exe: pasta do WSL clona com o login do git de lá.
  const viaToken = token && !parseWslPath(parent) ? githubHttpsUrl(url) : null;
  const safeUrl = viaToken ?? cloneUrl(url);
  if (!safeUrl || !NAME.test(name)) return { ok: false, error: tr('Endereço ou nome de pasta inválido.', 'Invalid address or folder name.') };
  const dir = expandHome(parent);
  const target = join(dir, name);
  if (existsSync(target)) return { ok: false, error: tr(`Já existe uma pasta "${name}" ali. Escolha outro lugar.`, `There is already a "${name}" folder there. Pick another place.`) };
  const env: NodeJS.ProcessEnv = {
    GIT_TERMINAL_PROMPT: '0',
    ...(!process.env.GIT_SSH_COMMAND && { GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' }),
    ...(viaToken && token && tokenEnv(token)),
  };
  try {
    await git(dir, ['clone', '--', safeUrl, name], { timeout: CLONE_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024, env });
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, error: reason(err) };
  }
}
