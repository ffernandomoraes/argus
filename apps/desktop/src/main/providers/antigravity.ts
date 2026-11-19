import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ProviderAccountStatus } from '@argus/shared/providers';
import { errorMessage } from '../lib/errors';
import { openAcpProcess } from './acpProcess';
import { providerLaunch } from './env';
import { providerAccountDir } from './paths';
import { RpcError, type JsonRpcProcess } from './rpc';

// Antigravity CLI (`agy`, da Google), pelo `agy acp` (conferido com o agy 1.5.12, nov/2026).
//
// O que a Google permite com o login Google de um plano pessoal (issue 1493 do repositório
// google-antigravity/antigravity-cli e a FAQ oficial): um cliente ACP em que a pessoa conduz a
// conversa pode rodar o `agy acp` sem modificar. Não pode: outro agente, fila ou rotina de fundo
// gerando os pedidos, trocar as instruções de identidade dele, nem rodízio automático de contas
// (para isso, só chave de API). Por isso o Argus nunca manda pedido sozinho para uma conta de
// login, nunca lê o token e tem uma conta Google só (a do terminal); as outras são por chave.

const LOGIN_TIMEOUT_MS = 10 * 60_000;

// Resposta do ACP para "sem login" (auth_required).
export const authRequired = (err: unknown): boolean => err instanceof RpcError && (err.code === -32000 || /authentication required/i.test(err.message));

// O ACP não diz de quem é a conta. O `agy` escreve o e-mail no log dele ao usar o login
// ("applyAuthResult: email=..., authMethod=consumer"): a conferência manda o log para um arquivo
// temporário e lê só essa linha. O token nunca passa por aqui. Se o texto mudar numa versão nova,
// a conta fica sem e-mail e nada mais quebra.
const LOG_EMAIL = /applyAuthResult: email=([^\s,]+@[^\s,]+)/;

function emailFromLog(file: string): string | undefined {
  try {
    return LOG_EMAIL.exec(readFileSync(file, 'utf8'))?.[1];
  } catch {
    return undefined;
  }
}

// Login da conta principal, sem abrir conversa: listar as conversas não cria nada e é recusado sem
// login. O `authenticate` não serve para conferir: sem login, ele abre a página da Google.
export async function antigravityStatus(accountId: string): Promise<ProviderAccountStatus | null> {
  const logFile = join(tmpdir(), `argus-agy-${randomUUID()}.log`);
  const launch = providerLaunch('antigravity', ['acp', `--log-file=${logFile}`], accountId);
  if (!launch) return null;
  let rpc: JsonRpcProcess | null = null;
  try {
    rpc = await openAcpProcess(launch);
    await rpc.request('session/list', {}, 20_000);
    return { signedIn: true, email: emailFromLog(logFile) };
  } catch (err) {
    if (authRequired(err)) return { signedIn: false };
    console.warn('[providers] antigravity session/list falhou:', errorMessage(err));
    return null;
  } finally {
    rpc?.close();
    rmSync(logFile, { force: true, maxRetries: 3, retryDelay: 200 });
  }
}

// Login Google da conta principal: o próprio `agy` abre a página no navegador e guarda o login no
// cofre do sistema, o mesmo do `agy` do terminal. `again`: com um login guardado que ainda vale, o
// `authenticate` responde sem abrir a página; "Entrar de novo" sai da conta antes.
export async function antigravitySignIn(rpc: JsonRpcProcess, again: boolean): Promise<void> {
  if (again) await rpc.request('logout', {}, 30_000).catch(() => {});
  await rpc.request('authenticate', { methodId: 'oauth-personal' }, LOGIN_TIMEOUT_MS);
}

// O `agy` grava um arquivo por conversa já no session/new (uns 400 KB), mesmo sem nenhum pedido. A
// conversa aberta só para ler os modelos da conta (agentChats/models.ts) sai daqui.
export function dropEmptyConversation(accountId: string, sessionId: string): void {
  if (!/^[0-9a-f-]{36}$/.test(sessionId)) return;
  const home = providerAccountDir('antigravity', accountId) ?? join(homedir(), '.gemini');
  const file = join(home, 'antigravity-cli', 'conversations', `${sessionId}.db`);
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      rmSync(file + suffix, { force: true, maxRetries: 3, retryDelay: 200 });
    } catch {
      // Fica o arquivo: não atrapalha nada.
    }
  }
}
