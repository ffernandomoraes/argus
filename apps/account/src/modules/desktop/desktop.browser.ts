import { fromNodeHeaders } from 'better-auth/node';
import { and, eq, lt, notExists } from 'drizzle-orm';
import { Router, type Request, type Response } from 'express';

import { isProvider, providerEnabled, type Config, type Provider } from '../../config';
import type { Database } from '../../db/client';
import type { Auth } from '../auth/auth';
import { session } from '../auth/auth.table';
import { createLoginCode, isChallenge, parseLang, parsePort } from './desktop.codes';
import { isDoneStatus, sendDonePage } from './desktop.pages';
import { phoneWaitRoutes } from './desktop.phoneWait';
import { desktopDevice } from './desktop.table';

// As páginas por onde o navegador passa no login do app do computador (fora de /api):
// 1. /auth/<provedor>/start: o app abre aqui com a porta da volta e o challenge; daqui o Better
//    Auth manda para o GitHub ou o Google;
// 2. /auth/<provedor>/callback: o endereço cadastrado no provedor; repassa para o Better Auth
//    (/api/auth/callback/<provedor>), que cria ou acha a pessoa e abre uma sessão no navegador;
// 3. /auth/finish/...: troca essa sessão do navegador por um código de uso único e manda o navegador
//    de volta ao app (http://127.0.0.1:<porta>/callback); /auth/failed/...: idem, com o erro;
// 4. /auth/done: a página final, para onde o app manda o navegador depois de receber a volta.
// O app do celular usa /auth/<provedor>/web: o mesmo caminho, voltando para WEB_APP_URL/#account=<código>.
// Instalado, o navegador não consegue voltar para ele: /auth/<provedor>/wait (desktop.phoneWait.ts).

type BrowserContext = { config: Config; db: Database; auth: Auth };

// A sessão do navegador vale só para o fim do login, logo depois da volta do provedor.
const BROWSER_SESSION_MS = 15 * 60_000;

const toApp = (res: Response, port: number, query: Record<string, string>) =>
  res.redirect(302, `http://127.0.0.1:${port}/callback?${new URLSearchParams(query)}`);

export function browserRoutes({ config, db, auth }: BrowserContext): Router {
  const router = Router();
  // Volta ao app do celular, com o código ou o erro depois do # (o navegador não manda essa parte
  // a servidor nenhum).
  const toWeb = (res: Response, hash: Record<string, string>) => res.redirect(302, `${config.WEB_APP_URL}/#${new URLSearchParams(hash)}`);

  // A sessão que a volta do GitHub ou do Google acabou de abrir neste navegador (o cookie). Só ela
  // vira código: nem o cabeçalho Authorization nem a sessão de um aparelho servem, senão um token
  // vazado virava uma sessão nova, com o nome de aparelho que o atacante quisesse.
  async function browserSession(req: Request) {
    const headers = fromNodeHeaders(req.headers);
    headers.delete('authorization');
    const found = await auth.api.getSession({ headers });
    if (!found) return null;
    const [device] = await db.select({ id: desktopDevice.sessionId }).from(desktopDevice).where(eq(desktopDevice.sessionId, found.session.id)).limit(1);
    if (device) return null;
    // Login largado no meio há mais tempo: a sessão sai e não vale.
    if (Date.now() - found.session.createdAt.getTime() > BROWSER_SESSION_MS) {
      await db.delete(session).where(eq(session.id, found.session.id));
      return null;
    }
    return found;
  }

  // As sessões de navegador de logins largados no meio (de todo mundo) saem a cada login novo.
  async function sweepBrowserSessions(): Promise<void> {
    const deviceOf = db.select({ id: desktopDevice.sessionId }).from(desktopDevice).where(eq(desktopDevice.sessionId, session.id));
    await db.delete(session).where(and(lt(session.createdAt, new Date(Date.now() - BROWSER_SESSION_MS)), notExists(deviceOf)));
  }

  // Manda o navegador para o GitHub ou o Google; na volta, o Better Auth segue para `callbackURL`
  // (ou `errorCallbackURL`). O estado do login vai num cookie, conferido na volta do provedor.
  async function toProvider(req: Request, res: Response, provider: Provider, back: { callbackURL: string; errorCallbackURL: string }): Promise<boolean> {
    await sweepBrowserSessions();
    const { headers, response } = await auth.api.signInSocial({
      body: { provider, ...back, disableRedirect: true },
      headers: fromNodeHeaders(req.headers),
      returnHeaders: true,
    });
    for (const cookie of headers.getSetCookie()) res.append('Set-Cookie', cookie);
    if (!('url' in response) || !response.url) return false;
    res.redirect(302, response.url);
    return true;
  }

  router.get('/auth/:provider/start', async (req, res) => {
    const { provider } = req.params;
    const lang = parseLang(req.query.lang);
    const port = parsePort(req.query.port);
    const challenge = req.query.challenge;
    if (!isProvider(provider) || !providerEnabled(config, provider) || !port || !isChallenge(challenge)) {
      sendDonePage(res, 'error', lang);
      return;
    }
    const base = config.PUBLIC_URL;
    if (!(await toProvider(req, res, provider, { callbackURL: `${base}/auth/finish/${port}/${challenge}/${lang}`, errorCallbackURL: `${base}/auth/failed/${port}/${lang}` }))) {
      sendDonePage(res, 'error', lang);
    }
  });

  // O login do app do celular: igual ao do computador, mas a volta é o próprio app do celular
  // (WEB_APP_URL, fixo: o código nunca vai para outro endereço), com o código depois do #.
  router.get('/auth/:provider/web', async (req, res) => {
    const { provider } = req.params;
    const lang = parseLang(req.query.lang);
    const challenge = req.query.challenge;
    if (!isProvider(provider) || !providerEnabled(config, provider) || !isChallenge(challenge)) {
      toWeb(res, { 'account-error': 'error' });
      return;
    }
    const base = config.PUBLIC_URL;
    if (!(await toProvider(req, res, provider, { callbackURL: `${base}/auth/web-finish/${challenge}`, errorCallbackURL: `${base}/auth/web-failed/${lang}` }))) {
      toWeb(res, { 'account-error': 'error' });
    }
  });

  router.get('/auth/:provider/callback', (req, res) => {
    const { provider } = req.params;
    if (!isProvider(provider)) {
      sendDonePage(res, 'error', 'en');
      return;
    }
    const query = new URL(req.originalUrl, config.PUBLIC_URL).search;
    res.redirect(302, `/api/auth/callback/${provider}${query}`);
  });

  router.get('/auth/finish/:port/:challenge/:lang', async (req, res) => {
    const port = parsePort(req.params.port);
    const { challenge } = req.params;
    if (!port || !isChallenge(challenge)) {
      sendDonePage(res, 'error', parseLang(req.params.lang));
      return;
    }
    const found = await browserSession(req);
    if (!found) {
      toApp(res, port, { error: 'error' });
      return;
    }
    const code = await createLoginCode(db, found.user.id, challenge);
    // A sessão do navegador servia só para chegar aqui: o app ganha a dele ao trocar o código.
    await db.delete(session).where(eq(session.id, found.session.id));
    toApp(res, port, { code });
  });

  router.get('/auth/failed/:port/:lang', (req, res) => {
    const port = parsePort(req.params.port);
    if (!port) {
      sendDonePage(res, 'error', parseLang(req.params.lang));
      return;
    }
    const error = typeof req.query.error === 'string' ? req.query.error : '';
    if (error !== 'access_denied') console.warn(`[account] Login não concluído: ${error.slice(0, 80) || 'sem motivo'}`);
    toApp(res, port, { error: error === 'access_denied' ? 'denied' : 'error' });
  });

  router.get('/auth/web-finish/:challenge', async (req, res) => {
    const { challenge } = req.params;
    const found = isChallenge(challenge) ? await browserSession(req) : null;
    if (!found) {
      toWeb(res, { 'account-error': 'error' });
      return;
    }
    const code = await createLoginCode(db, found.user.id, challenge);
    await db.delete(session).where(eq(session.id, found.session.id));
    toWeb(res, { account: code });
  });

  router.get('/auth/web-failed/:lang', (req, res) => {
    const error = typeof req.query.error === 'string' ? req.query.error : '';
    toWeb(res, { 'account-error': error === 'access_denied' ? 'denied' : 'error' });
  });

  router.use(phoneWaitRoutes({ config, db, browserSession, toProvider }));

  router.get('/auth/done', (req, res) => {
    const status = req.query.status;
    sendDonePage(res, isDoneStatus(status) ? status : 'error', parseLang(req.query.lang));
  });

  router.get('/', (_req, res) => {
    res.redirect(302, 'https://argusterm.com');
  });

  return router;
}
