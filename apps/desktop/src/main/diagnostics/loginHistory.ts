import { createHash } from 'node:crypto';
import { argusClaudes } from './claudeProcesses';
import { note } from './journal';

// Quando o login guardado de cada conta mudou, e se havia algum `claude` do Argus aberto daquela conta
// naquela hora. O Claude Code renova o login sozinho e grava o novo; se dois renovam ao mesmo tempo
// (o do Argus e o do terminal, que na conta principal do Mac usam o mesmo item das Chaves), o servidor
// recusa um deles e o Claude Code apaga o login. Sem saber quem renovou, o "login perdido" ficava sem
// causa (ARGUS-K, 2026-11-18).
//
// O login nunca sai daqui: só uma impressão digital dele (8 letras de um resumo SHA-256 do código de
// renovação), que muda quando o login muda e não dá para desfazer.

// O que importa do login guardado (ver claudeAuth/store.ts, que chama observeLogin a cada leitura).
type StoredLogin = {
  claudeAiOauth?: { accessToken?: string; refreshToken?: string; expiresAt?: number; refreshTokenExpiresAt?: number; loginEnded?: string };
} | null;

type Seen = { fingerprint: string | null; state: string; at: number };
export type LoginChange = { at: number; from: string | null; to: string | null; state: string; argusClaudes: number; sincePreviousReadMs: number };

const CHANGES_KEPT = 10;
const seen = new Map<string, Seen>();
const changes = new Map<string, LoginChange[]>();

export function fingerprintOf(stored: StoredLogin): string | null {
  const oauth = stored?.claudeAiOauth;
  const secret = oauth?.refreshToken || oauth?.accessToken;
  return secret ? createHash('sha256').update(secret).digest('hex').slice(0, 8) : null;
}

// Prazos do login, em minutos (o de acesso, renovado a cada poucas horas) e em dias (o do código de
// renovação: vencido, o Claude Code apaga o login com loginEnded "time_limit").
function minutesUntil(at: number | undefined, now: number): number | null {
  return typeof at === 'number' && at > 0 ? Math.round((at - now) / 60_000) : null;
}

const expiresInMin = (stored: StoredLogin, now: number) => minutesUntil(stored?.claudeAiOauth?.expiresAt, now);

function refreshExpiresInDays(stored: StoredLogin, now: number): number | null {
  const min = minutesUntil(stored?.claudeAiOauth?.refreshTokenExpiresAt, now);
  return min === null ? null : Math.round(min / 1440);
}

// Uma leitura do login guardado da conta (place: a pasta da conta dentro de uma distro do WSL). A
// primeira de cada conta e cada mudança entram no diário; leitura que falhou não conta.
export type LoginRead = { account: string; place?: string; stored: StoredLogin; state: string };

export function observeLogin({ account, place, stored, state }: LoginRead, now = Date.now()): void {
  if (state === 'unreadable') return;
  const key = `${account}@${place ?? ''}`;
  const fingerprint = fingerprintOf(stored);
  const before = seen.get(key);
  seen.set(key, { fingerprint, state, at: now });
  const wsl = place ? true : undefined;
  if (!before) {
    note('login', 'login guardado lido', { account, wsl, fingerprint, state, expiresInMin: expiresInMin(stored, now), refreshExpiresInDays: refreshExpiresInDays(stored, now) });
    return;
  }
  if (before.fingerprint === fingerprint && before.state === state) return;
  const change: LoginChange = {
    at: now,
    from: before.fingerprint,
    to: fingerprint,
    state,
    argusClaudes: argusClaudes(account),
    sincePreviousReadMs: now - before.at,
  };
  const list = changes.get(account) ?? [];
  list.push(change);
  if (list.length > CHANGES_KEPT) list.shift();
  changes.set(account, list);
  const loginEnded = stored?.claudeAiOauth?.loginEnded;
  note('login', state === 'ended' ? 'login apagado pelo Claude Code' : 'login guardado mudou', {
    account,
    wsl,
    from: before.fingerprint,
    to: fingerprint,
    state,
    expiresInMin: expiresInMin(stored, now),
    refreshExpiresInDays: refreshExpiresInDays(stored, now),
    argusClaudes: change.argusClaudes,
    minutesSincePreviousRead: Math.round(change.sincePreviousReadMs / 60_000),
    loginEnded: typeof loginEnded === 'string' ? loginEnded : undefined,
  });
}

// As últimas mudanças do login da conta, para o aviso de login perdido: há quanto tempo, para que
// estado e quantos `claude` do Argus a conta tinha abertos (0 = quem mudou foi outro programa, como o
// Claude Code do terminal; ou a leitura anterior foi há tanto tempo que não dá para dizer).
export function recentLoginChanges(account: string, now = Date.now()): string {
  return (changes.get(account) ?? [])
    .slice(-5)
    .map((c) => `${Math.round((now - c.at) / 60_000)} min atrás: ${c.state}, argus=${c.argusClaudes}, leitura anterior ${Math.round(c.sincePreviousReadMs / 60_000)} min antes`)
    .join(' | ');
}

// Para os testes.
export function clearLoginHistory(): void {
  seen.clear();
  changes.clear();
}
