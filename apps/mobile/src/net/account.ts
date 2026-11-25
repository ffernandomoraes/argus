import { LANGUAGE, tr } from '../i18n';

// Conta do Argus no app do celular: entrar com o GitHub ou o Google e ver os computadores da conta
// com o acesso remoto ligado, para parear sem código. O login vai pelo navegador até o servidor da
// conta e volta para cá com um código de uso único depois do # (#account=...); só este aparelho tem o
// segredo que troca o código pela sessão. O pareamento em si é o de sempre (pairing.ts), com o
// código que o computador publicou na conta.

export type AccountProvider = 'github' | 'google';
export type AccountSession = { token: string; name: string; email: string | null };
// Computador da conta com o acesso remoto ligado; code: o código aberto agora (nulo: desligado).
export type AccountHost = { hostId: string; name: string; platform: string; code: string | null };

const SESSION_KEY = 'argus-account';
const VERIFIER_KEY = 'argus-account-verifier';
const PUBLISHED_ACCOUNT = 'https://account.argusterm.com';

export function accountBase(): string {
  const env = import.meta.env.VITE_ACCOUNT_URL as string | undefined;
  return (env || PUBLISHED_ACCOUNT).replace(/\/+$/, '');
}

const base64url = (bytes: Uint8Array) => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export function loadAccount(): AccountSession | null {
  try {
    const v = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as Partial<AccountSession> | null;
    return v && typeof v.token === 'string' && typeof v.name === 'string' ? { token: v.token, name: v.name, email: v.email ?? null } : null;
  } catch {
    return null;
  }
}

function saveAccount(session: AccountSession | null): void {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Sem armazenamento: a conta vale até fechar o app.
  }
}

// Vai para o login. O segredo fica guardado aqui até a volta.
export async function startAccountLogin(provider: AccountProvider): Promise<void> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  localStorage.setItem(VERIFIER_KEY, verifier);
  const query = new URLSearchParams({ challenge, lang: LANGUAGE === 'pt' ? 'pt' : 'en' });
  location.assign(`${accountBase()}/auth/${provider}/web?${query}`);
}

function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  return tr('Celular', 'Phone');
}

async function api<T>(path: string, token: string | null, init: { method?: string; body?: unknown } = {}): Promise<T | null> {
  const res = await fetch(`${accountBase()}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      ...(token && { authorization: `Bearer ${token}` }),
      ...(init.body !== undefined && { 'content-type': 'application/json' }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (res.status === 401) throw new SignedOut();
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.status === 204 ? null : ((await res.json()) as T);
}

// A sessão acabou no servidor (saiu por outro aparelho, a conta foi apagada).
export class SignedOut extends Error {}

// Volta do login: troca o código pela sessão deste aparelho. Erro em texto, ou nulo.
export async function finishAccountLogin(code: string): Promise<string | null> {
  const verifier = localStorage.getItem(VERIFIER_KEY);
  localStorage.removeItem(VERIFIER_KEY);
  if (!verifier) return tr('O login começou em outro lugar. Tente entrar de novo por aqui.', 'The sign-in started somewhere else. Try signing in again from here.');
  try {
    const r = await api<{ token?: unknown; profile?: { name?: unknown; email?: unknown } }>('/api/desktop/redeem', null, {
      method: 'POST',
      body: { code, verifier, device: { name: deviceName(), platform: 'web' } },
    });
    if (typeof r?.token !== 'string') throw new Error('sem token');
    const name = typeof r.profile?.name === 'string' ? r.profile.name : 'Argus';
    saveAccount({ token: r.token, name, email: typeof r.profile?.email === 'string' ? r.profile.email : null });
    return null;
  } catch {
    return tr('Não deu para entrar. Tente de novo.', "Couldn't sign in. Try again.");
  }
}

export function loginErrorText(error: string): string {
  return error === 'denied'
    ? tr('Login cancelado.', 'Sign-in canceled.')
    : tr('Não deu para entrar. Tente de novo daqui a pouco.', "Couldn't sign in. Try again in a moment.");
}

// Os computadores da conta com o acesso ligado. Sessão encerrada: sai da conta aqui e devolve nulo.
export async function listAccountHosts(): Promise<AccountHost[] | null> {
  const session = loadAccount();
  if (!session) return null;
  try {
    const r = await api<{ hosts?: { hostId?: unknown; name?: unknown; platform?: unknown; code?: unknown }[] }>('/api/remote/hosts', session.token);
    return (r?.hosts ?? []).flatMap((h) =>
      typeof h.hostId === 'string'
        ? [{ hostId: h.hostId, name: typeof h.name === 'string' ? h.name : 'Argus', platform: typeof h.platform === 'string' ? h.platform : 'other', code: typeof h.code === 'string' ? h.code : null }]
        : [],
    );
  } catch (err) {
    if (err instanceof SignedOut) saveAccount(null);
    throw err;
  }
}

// O bilhete da conta para parear com o computador `hostId` (vai junto no pareamento). Nulo: não deu.
export async function pairTicket(hostId: string): Promise<string | null> {
  const session = loadAccount();
  if (!session) return null;
  try {
    const r = await api<{ ticket?: unknown }>('/api/remote/ticket', session.token, { method: 'POST', body: { hostId } });
    return typeof r?.ticket === 'string' ? r.ticket : null;
  } catch (err) {
    if (err instanceof SignedOut) saveAccount(null);
    return null;
  }
}

export async function signOutAccount(): Promise<void> {
  const session = loadAccount();
  saveAccount(null);
  if (session) await api('/api/logout', session.token, { method: 'POST' }).catch(() => {});
}
