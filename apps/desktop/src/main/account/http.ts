import { app } from 'electron';

// Pedidos ao servidor da conta (apps/account, na Railway). ARGUS_ACCOUNT_URL troca o endereço só no
// app de desenvolvimento (o servidor rodando local com `pnpm --filter @argus/account dev`, por
// exemplo): no instalado, uma variável de ambiente mandaria o token da conta para outro servidor.

const DEFAULT_URL = 'https://account.argusterm.com';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
// Teto de uma resposta do servidor da conta. A maior que existe é importar todas as instruções e skills
// de uma vez (até 10 MB de texto, mais o JSON em volta).
export const MAX_RESPONSE_BYTES = 24 * 1024 * 1024;

let refused: string | null = null;

// O endereço do servidor: o padrão, ou o de ARGUS_ACCOUNT_URL no app de desenvolvimento, se for https
// (http só no próprio computador).
export function accountUrlFrom(override: string | undefined, packaged: boolean): string {
  if (!override || packaged) return DEFAULT_URL;
  try {
    const u = new URL(override);
    const allowed = u.protocol === 'https:' || (u.protocol === 'http:' && LOCAL_HOSTS.has(u.hostname));
    if (allowed && !u.username && !u.password) return `${u.origin}${u.pathname}`.replace(/\/+$/, '');
  } catch {
    // Endereço inválido: fica o padrão.
  }
  if (refused !== override) console.warn('[account] ARGUS_ACCOUNT_URL recusado: só https, ou http no próprio computador');
  refused = override;
  return DEFAULT_URL;
}

export function accountUrl(): string {
  return accountUrlFrom(process.env.ARGUS_ACCOUNT_URL, app.isPackaged);
}

// Resposta de erro do servidor (a falta de rede vem como a exceção do fetch).
export class AccountHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// O servidor não reconhece a sessão: saiu por outro aparelho, a conta foi apagada ou venceu.
export const isUnauthorized = (err: unknown): boolean => err instanceof AccountHttpError && err.status === 401;

// O corpo inteiro, até `max` bytes: passou disso, a leitura para (um servidor com defeito não enche
// a memória do app).
export async function readBody(res: Response, max: number): Promise<Buffer> {
  const tooLarge = () => new AccountHttpError(res.status, `response larger than ${max} bytes`);
  if (Number(res.headers.get('content-length')) > max) {
    await res.body?.cancel().catch(() => undefined);
    throw tooLarge();
  }
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

type Options = { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; token?: string; body?: unknown; timeoutMs?: number };

// Nulo: resposta sem corpo (204).
export async function accountRequest<T>(path: string, { method = 'GET', token, body, timeoutMs = 15_000 }: Options = {}): Promise<T | null> {
  const res = await fetch(`${accountUrl()}${path}`, {
    method,
    headers: {
      ...(token && { authorization: `Bearer ${token}` }),
      ...(body !== undefined && { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    // Redirecionamento levaria o token junto para outro endereço: o servidor da conta nunca manda.
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new AccountHttpError(res.status, `${method} ${path}: ${res.status}`);
  }
  if (res.status === 204) return null;
  return JSON.parse((await readBody(res, MAX_RESPONSE_BYTES)).toString('utf8')) as T;
}
