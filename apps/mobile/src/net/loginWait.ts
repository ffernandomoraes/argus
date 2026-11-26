import { LANGUAGE } from '../i18n';
import { accountBase, base64url, deviceName, saveAccount, type AccountProvider } from './account';

// Login da conta com o app instalado (iPhone, Android). O login abre no navegador, e o navegador não
// consegue voltar para o app instalado (nem tem o que o app guardou: no iPhone, cada um tem o seu
// armazenamento). Então o app guarda o segredo, abre o login e fica perguntando ao servidor, com o
// segredo, se o login terminou; no fim, a página do navegador mostra o código curto daqui para a
// pessoa conferir e confirmar (ver apps/account desktop.phoneWait.ts).

export type PendingLogin = { verifier: string; challenge: string; provider: AccountProvider; startedAt: number };

const PENDING_KEY = 'argus-account-pending';
// A sessão do navegador no servidor vale 15 minutos; depois disso, não adianta esperar.
const PENDING_MS = 15 * 60_000;

export function loadPendingLogin(): PendingLogin | null {
  try {
    const v = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as PendingLogin | null;
    if (v && typeof v.verifier === 'string' && typeof v.challenge === 'string' && Date.now() - v.startedAt < PENDING_MS) return v;
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Sem armazenamento: não há o que esperar.
  }
  return null;
}

export function cancelPendingLogin(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nada guardado.
  }
}

function loginUrl(pending: PendingLogin): string {
  const query = new URLSearchParams({ challenge: pending.challenge, lang: LANGUAGE === 'pt' ? 'pt' : 'en' });
  return `${accountBase()}/auth/${pending.provider}/wait?${query}`;
}

// Abre o login no navegador. O app fica onde está, esperando (window.open); se o navegador recusar a
// janela nova, vai na mesma, e a espera continua quando a pessoa voltar ao app.
export function openPendingLogin(pending: PendingLogin): void {
  const url = loginUrl(pending);
  if (!window.open(url, '_blank')) location.assign(url);
}

export async function startWaitingLogin(provider: AccountProvider): Promise<PendingLogin> {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const pending: PendingLogin = { verifier, challenge, provider, startedAt: Date.now() };
  localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  openPendingLogin(pending);
  return pending;
}

// Pergunta se o login terminou. 'done': a conta já está guardada; 'failed': não vale mais (a espera
// sai); 'pending': ainda não (ou sem internet agora).
export async function pollPendingLogin(pending: PendingLogin): Promise<'pending' | 'done' | 'failed'> {
  const res = await fetch(`${accountBase()}/api/desktop/redeem-wait`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ verifier: pending.verifier, device: { name: deviceName(), platform: 'web' } }),
  }).catch(() => null);
  if (!res || res.status === 202 || res.status === 429 || res.status >= 500) return 'pending';
  if (!res.ok) {
    cancelPendingLogin();
    return 'failed';
  }
  const r = (await res.json().catch(() => null)) as { token?: unknown; profile?: { name?: unknown; email?: unknown } } | null;
  cancelPendingLogin();
  if (typeof r?.token !== 'string') return 'failed';
  saveAccount({ token: r.token, name: typeof r.profile?.name === 'string' ? r.profile.name : 'Argus', email: typeof r.profile?.email === 'string' ? r.profile.email : null });
  return 'done';
}

// O código curto que a página do navegador repete. Igual ao confirmCodeOf de apps/account
// (desktop.codes.ts): os 32 primeiros bits do challenge, 5 a 5, num alfabeto sem 0/O e 1/I.
const CONFIRM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function confirmCodeOf(challenge: string): string {
  const bytes = Uint8Array.from(atob(challenge.slice(0, 8).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const n = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  let code = '';
  for (let i = 0; i < 6; i++) code += CONFIRM_ALPHABET[(n >>> (i * 5)) & 31];
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}
