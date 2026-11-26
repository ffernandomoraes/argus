import { eq } from 'drizzle-orm';
import { Router, type Request, type Response } from 'express';

import { isProvider, providerEnabled, type Config, type Provider } from '../../config';
import type { Database } from '../../db/client';
import { session } from '../auth/auth.table';
import { confirmCodeOf, createLoginCode, isChallenge, parseLang } from './desktop.codes';
import { sendConfirmPage, sendDonePage } from './desktop.pages';

// O login do app do celular instalado (iPhone, Android). O navegador não consegue voltar para o app
// instalado, então:
// 1. /auth/<provedor>/wait: o app abre aqui com o challenge; daqui, GitHub ou Google (como no
//    desktop.browser.ts);
// 2. /auth/web-confirm/...: de volta do provedor, a página mostra o código curto que o app mostra e
//    pede para confirmar; a confirmação guarda o login no challenge;
// 3. o app pergunta com o segredo se o login terminou (/api/desktop/redeem-wait, desktop.module.ts).

type Back = { callbackURL: string; errorCallbackURL: string };
type WaitContext = {
  config: Config
  db: Database
  // A sessão que a volta do provedor abriu no navegador (ver desktop.browser.ts).
  browserSession: (req: Request) => Promise<{ user: { id: string }; session: { id: string } } | null>
  toProvider: (req: Request, res: Response, provider: Provider, back: Back) => Promise<boolean>
};

export function phoneWaitRoutes({ config, db, browserSession, toProvider }: WaitContext): Router {
  const router = Router();

  router.get('/auth/:provider/wait', async (req, res) => {
    const { provider } = req.params;
    const lang = parseLang(req.query.lang);
    const challenge = req.query.challenge;
    const base = config.PUBLIC_URL;
    const ok =
      isProvider(provider) &&
      providerEnabled(config, provider) &&
      isChallenge(challenge) &&
      (await toProvider(req, res, provider, { callbackURL: `${base}/auth/web-confirm/${challenge}/${lang}`, errorCallbackURL: `${base}/auth/web-wait-failed/${lang}` }));
    if (!ok) sendDonePage(res, 'error', lang);
  });

  // Fim do login do app do celular instalado: a página pede para conferir o código e confirmar
  // (GET); a confirmação (POST, mesmo endereço, com o cookie do navegador) libera a sessão para o app.
  router.get('/auth/web-confirm/:challenge/:lang', async (req, res) => {
    const { challenge } = req.params;
    const lang = parseLang(req.params.lang);
    if (!isChallenge(challenge) || !(await browserSession(req))) {
      sendDonePage(res, 'expired', lang);
      return;
    }
    sendConfirmPage(res, lang, confirmCodeOf(challenge));
  });

  router.post('/auth/web-confirm/:challenge/:lang', async (req, res) => {
    const { challenge } = req.params;
    const lang = parseLang(req.params.lang);
    const found = isChallenge(challenge) ? await browserSession(req) : null;
    if (!found) {
      sendDonePage(res, 'expired', lang);
      return;
    }
    await createLoginCode(db, found.user.id, challenge);
    await db.delete(session).where(eq(session.id, found.session.id));
    sendDonePage(res, 'phone', lang);
  });

  router.get('/auth/web-wait-failed/:lang', (req, res) => {
    const error = typeof req.query.error === 'string' ? req.query.error : '';
    if (error !== 'access_denied') console.warn(`[account] Login do celular não concluído: ${error.slice(0, 80) || 'sem motivo'}`);
    sendDonePage(res, error === 'access_denied' ? 'denied' : 'error', parseLang(req.params.lang));
  });

  return router;
}
