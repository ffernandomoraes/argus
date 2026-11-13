import { accountIds, defaultAccount } from '../accounts';
import { renewWithClaude } from './renew';
import { readStored, type OAuth } from './store';

// Login do Claude Code (o mesmo que o Agent SDK usa), para chamadas que não passam pelo SDK, como
// a transcrição do ditado. Só lê: vencido, quem renova é o próprio `claude` (ver renew.ts).

// Vencendo em menos que isso, pede a renovação, para não cair no meio de um ditado.
const MARGIN_MS = 5 * 60_000;
// Depois de pedir, serve o que ainda valer por este tempo (o `claude` pode renovar só mais perto).
const MIN_LEFT_MS = 30_000;

const validFor = (oauth: OAuth, ms: number) => !oauth.expiresAt || Date.now() + ms < oauth.expiresAt;

// A conta padrão primeiro; sem login nela, as outras (a principal antes das adicionadas).
async function findToken(): Promise<string | null> {
  const order = [...new Set([defaultAccount(), ...accountIds()])];
  // Vencido mesmo depois de pedir a renovação: fica de reserva, se nenhuma conta tiver um válido.
  let stale: string | null = null;
  for (const account of order) {
    const oauth = (await readStored(account))?.claudeAiOauth;
    if (!oauth?.accessToken) continue;
    if (validFor(oauth, MARGIN_MS)) return oauth.accessToken;
    await renewWithClaude(account);
    const renewed = (await readStored(account))?.claudeAiOauth;
    if (renewed?.accessToken && validFor(renewed, MIN_LEFT_MS)) return renewed.accessToken;
    stale ??= renewed?.accessToken || oauth.accessToken;
  }
  // Tenta com o que tem: o serviço responde se não valer mais.
  return stale;
}

let pending: Promise<string | null> | null = null;

// Token de acesso válido, ou null sem login do Claude Code em nenhuma conta. Nunca rejeita.
export function claudeAccessToken(): Promise<string | null> {
  pending ??= findToken()
    .catch(() => null)
    .finally(() => {
      pending = null;
    });
  return pending;
}
