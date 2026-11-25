import { Router, type Request, type Response } from 'express';

import { githubAppEnabled, type Config } from '../../config';
import { isChallenge, parseLang, parsePort, type Lang } from '../desktop/desktop.codes';
import { sendDonePage } from '../desktop/desktop.pages';
import { exchangeCode, fetchUser, githubAuthorizeUrl } from './github.client';
import { githubFlows } from './github.flows';

// As páginas por onde o navegador passa ao conectar o GitHub (fora de /api):
// 1. /github/start?port&challenge&lang: o app abre aqui; daqui vai para a autorização no GitHub;
// 2. /github/callback: o endereço cadastrado no app do GitHub; troca o código pelas chaves e manda o
//    navegador de volta ao app (http://127.0.0.1:<porta>/callback) com um código de uso único;
// 3. /github/installed: o "Setup URL" do app do GitHub, depois de a pessoa escolher os repositórios.

const toApp = (res: Response, port: number, query: Record<string, string>) =>
  res.redirect(302, `http://127.0.0.1:${port}/callback?${new URLSearchParams(query)}`);

// Sem o idioma do app (a volta da instalação vem do GitHub): o do navegador.
const browserLang = (req: Request): Lang => (/^pt\b/i.test(req.get('accept-language') ?? '') ? 'pt' : 'en');

export function githubBrowserRoutes({ config }: { config: Config }): Router {
  const router = Router();

  router.get('/github/start', (req, res) => {
    const lang = parseLang(req.query.lang);
    const port = parsePort(req.query.port);
    const challenge = req.query.challenge;
    if (!githubAppEnabled(config) || !port || !isChallenge(challenge)) return void sendDonePage(res, 'error', lang);
    const state = githubFlows.start({ port, challenge, lang });
    res.redirect(302, githubAuthorizeUrl(config, state));
  });

  router.get('/github/callback', async (req, res) => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const flow = githubFlows.finish(state);
    if (!flow) return void sendDonePage(res, 'expired', browserLang(req));
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) return void toApp(res, flow.port, { error: req.query.error === 'access_denied' ? 'denied' : 'error' });
    try {
      const tokens = await exchangeCode(config, code);
      const user = await fetchUser(tokens.accessToken);
      toApp(res, flow.port, { code: githubFlows.createCode(flow.challenge, { tokens, githubId: user.id, login: user.login }) });
    } catch (err) {
      console.warn('[account] GitHub: conexão não concluída:', err instanceof Error ? err.message : err);
      toApp(res, flow.port, { error: 'error' });
    }
  });

  router.get('/github/installed', (req, res) => {
    sendDonePage(res, 'installed', browserLang(req));
  });

  return router;
}
