import { join } from 'node:path';
import type { Account } from '@argus/shared/auth';
import { claudeLaunch } from '../chats';
import { runGently } from '../lib/childProcess';
import { readJsonFileAsync } from '../lib/jsonFile';
import { claudeJsonDir } from '../claudeHome';
import { distroFor } from '../wsl';
import { readStoredState } from '../claudeAuth/store';
import { withTimeout } from '../lib/timeout';
import { emailFrom, parseAuthStatus, parseFailedStatus, profileFrom, storedHint, type StoredHint } from './parseStatus';

// Comando do `claude` fora do SDK, sem janela de terminal no Windows. No WSL o prazo é maior: o
// primeiro wsl.exe liga a máquina virtual. Passado o prazo, para de esperar mas não mata na hora: um
// `claude` morto no meio de uma renovação levava o login junto (ver closeGently).
// place: uma pasta do WSL, para rodar o `claude` daquela distro (ver wslPlace.ts); sem ela, o do app.
export async function runClaude(args: string[], account: string, place?: string) {
  const l = await claudeLaunch(args, account, place);
  if (!l.ok) throw new Error(l.error);
  return runGently(l.file, l.args, { env: l.env, cwd: l.cwd, timeoutMs: distroFor(place) ? 30_000 : 15_000, graceMs: 30_000 });
}

// O .claude.json da conta, sem segurar o app: com o Claude só no WSL, o arquivo está lá, e a máquina
// virtual ainda desligada (ou lenta) segurava o app inteiro enquanto respondia.
const readConfig = (id: string, place?: string) => readJsonFileAsync(join(claudeJsonDir(id, place), '.claude.json'));

// E-mail do login atual da conta, lido do .claude.json dela (place: o da conta dentro de uma distro
// do WSL). undefined se não deu para ler.
export async function configEmail(id: string, place?: string): Promise<string | undefined> {
  const read = await readConfig(id, place);
  return read.status === 'ok' ? emailFrom(read.data) : undefined;
}

// Leitura do login guardado depois do `auth status`, o mesmo prazo do monitor de uso.
const STORED_TIMEOUT_MS = 10_000;

// ok: o `claude` respondeu (logado ou não). Falha (tempo esgotado, `claude` que não abriu): quem
// pergunta decide o que fazer com o que já sabia. renewing: a resposta vale por agora, mas o login
// ainda vai ser renovado (ou apagado); conferir de novo logo (ver storedHint).
export type AccountRead = { ok: true; account: Account; renewing?: boolean } | { ok: false };

// Uma pergunta ao `claude auth status`. Sem login ele sai com erro (ver parseFailedStatus).
async function askStatus(id: string, place?: string): Promise<Account> {
  const { stdout } = await runClaude(['auth', 'status', '--json'], id, place);
  // Nome da pessoa e identificador da conta, guardados pelo Claude Code no .claude.json dela (ver
  // profileFrom).
  const config = await readConfig(id, place);
  return parseAuthStatus(stdout, (email) => (config.status === 'ok' ? profileFrom(config.data, email) : {}));
}

// A pista do login guardado (ver storedHint). Sem resposta a tempo (no WSL, o arquivo atrás do
// \\wsl.localhost), vale o que o `auth status` disse.
async function hintFor(account: Account, id: string, place?: string): Promise<StoredHint> {
  if (!account.loggedIn || account.method !== 'claude.ai') return 'final';
  const read = await withTimeout(readStoredState(id, place), STORED_TIMEOUT_MS, null);
  return read ? storedHint(account, read.stored, read.state, Date.now()) : 'final';
}

export async function readAccount(id: string, place?: string): Promise<AccountRead> {
  try {
    const account = await askStatus(id, place);
    const hint = await hintFor(account, id, place);
    // O login guardado está apagado: este `auth status` pode ter sido o que apagou (e respondeu
    // "logada" mesmo assim). Quem diz se a conta está logada é a pergunta seguinte.
    if (hint === 'confirm') return { ok: true, account: await askStatus(id, place) };
    return { ok: true, account, ...(hint === 'renewing' && { renewing: true }) };
  } catch (err) {
    const account = parseFailedStatus((err as { stdout?: string }).stdout);
    if (account) return { ok: true, account };
    console.warn('[auth] claude auth status falhou:', (err as Error).message);
    return { ok: false };
  }
}
