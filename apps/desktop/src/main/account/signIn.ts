import { createHash, randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import { shell } from 'electron';
import type { AccountError, AccountProvider } from '@argus/shared/account';
import { lang } from '../i18n';
import { AccountHttpError, accountRequest, accountUrl } from './http';
import { openLoopback, type Loopback } from './loopback';

// O login, do lado do app (o do servidor está em apps/account/src/login.ts):
// 1. sorteia um segredo (verifier) e abre o navegador no servidor com o hash dele e a porta da volta;
// 2. a pessoa entra no GitHub ou no Google; o servidor manda o navegador de volta para 127.0.0.1;
// 3. o código que voltou, junto com o segredo, vira a sessão (só este app sabe o segredo).

const TIMEOUT_MS = 10 * 60_000;

export type SignInOutcome = { ok: true; token: string; profile: unknown } | { ok: false; error: AccountError | null };

// O nome deste computador na lista de aparelhos da conta (o mesmo do acesso remoto).
const deviceName = () => hostname().replace(/\.local$/i, '');

async function redeem(code: string, verifier: string): Promise<{ token: string; profile: unknown }> {
  const body = { code, verifier, device: { name: deviceName(), platform: process.platform } };
  const r = await accountRequest<{ token?: unknown; profile?: unknown }>('/api/desktop/redeem', { method: 'POST', body });
  if (typeof r?.token !== 'string') throw new Error('resposta sem token');
  return { token: r.token, profile: r.profile };
}

// Um login por vez: começar outro cancela o anterior.
export class SignInFlow {
  private cancelCurrent: (() => void) | null = null;

  cancel(): void {
    this.cancelCurrent?.();
  }

  async run(provider: AccountProvider): Promise<SignInOutcome> {
    this.cancel();
    const verifier = randomBytes(32).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    let loopback: Loopback;
    try {
      loopback = await openLoopback();
    } catch (err) {
      console.warn('[account] não deu para esperar a volta do login:', err);
      return { ok: false, error: 'failed' };
    }
    const language = lang();
    const done = (status: 'ok' | 'denied' | 'error') => `${accountUrl()}/auth/done?status=${status}&lang=${language}`;

    let timer: NodeJS.Timeout | undefined;
    let mine: (() => void) | null = null;
    const stopped = new Promise<'canceled' | 'expired'>((resolve) => {
      timer = setTimeout(() => resolve('expired'), TIMEOUT_MS);
      mine = () => resolve('canceled');
      this.cancelCurrent = mine;
    });
    const query = new URLSearchParams({ port: String(loopback.port), challenge, lang: language });
    void shell.openExternal(`${accountUrl()}/auth/${provider}/start?${query}`);

    try {
      const back = await Promise.race([loopback.result, stopped]);
      if (back === 'canceled' || back === 'expired') {
        loopback.close();
        return { ok: false, error: back === 'expired' ? 'expired' : null };
      }
      if ('error' in back) {
        loopback.finish(done(back.error));
        return { ok: false, error: back.error === 'denied' ? 'denied' : 'failed' };
      }
      try {
        const session = await redeem(back.code, verifier);
        loopback.finish(done('ok'));
        return { ok: true, ...session };
      } catch (err) {
        console.warn('[account] troca do código pela sessão falhou:', err);
        loopback.finish(done('error'));
        return { ok: false, error: err instanceof AccountHttpError ? 'failed' : 'offline' };
      }
    } finally {
      clearTimeout(timer);
      if (this.cancelCurrent === mine) this.cancelCurrent = null;
    }
  }
}
