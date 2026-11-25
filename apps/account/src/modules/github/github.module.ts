import { Router, type Response } from 'express';

import { githubAppEnabled } from '../../config';
import { badRequest } from '../../errors';
import { currentUser } from '../../middlewares/requireAuth';
import { isCode, isVerifier } from '../desktop/desktop.codes';
import type { ApiModule } from '../types';
import { GitHubAuthError, githubInstallUrl, installationCount, listInstallations, listRepos } from './github.client';
import { githubFlows } from './github.flows';
import { GitHubLinks } from './github.service';

// GitHub conectado à conta, para clonar pelo Argus (ver github.table.ts e github.browser.ts).
// GET    /api/github         { available, login?, installUrl? }
// POST   /api/github/link    { code, verifier }: termina a conexão começada no navegador
// GET    /api/github/repos   os repositórios liberados
// GET    /api/github/installations  as contas e organizações conectadas (com a página de cada uma)
// POST   /api/github/token   a chave de acesso (só leitura, vence em até 8 h) para o git clone
// DELETE /api/github         desconecta (e desfaz a autorização no GitHub)
// Sem conexão (ou ela acabou no GitHub): 409 { error: 'notConnected' }; sem app configurado: 409
// { error: 'unavailable' }.
export const githubModule: ApiModule = ({ db, config, authed }) => {
  const router = Router();
  const links = new GitHubLinks(db, config);
  const installUrl = githubInstallUrl(config);

  const refuse = (res: Response, error: 'notConnected' | 'unavailable') => res.status(409).json({ error });

  // Pedido que precisa da chave; a conexão que acabou no GitHub sai daqui.
  async function withToken(userId: string, res: Response, run: (token: string, expiresAt: Date | null) => Promise<void>): Promise<void> {
    if (!githubAppEnabled(config)) return void refuse(res, 'unavailable');
    try {
      const access = await links.accessToken(userId);
      if (!access) return void refuse(res, 'notConnected');
      await run(access.token, access.expiresAt);
    } catch (err) {
      if (!(err instanceof GitHubAuthError)) throw err;
      await links.remove(userId, false);
      refuse(res, 'notConnected');
    }
  }

  router.get('/github', authed, async (req, res) => {
    if (!githubAppEnabled(config)) return void res.json({ available: false });
    const login = await links.login(currentUser(req).id);
    res.json({ available: true, ...(login && { login, installUrl }) });
  });

  router.post('/github/link', authed, async (req, res) => {
    if (!githubAppEnabled(config)) return void refuse(res, 'unavailable');
    const { code, verifier } = (req.body ?? {}) as { code?: unknown; verifier?: unknown };
    if (!isCode(code) || !isVerifier(verifier)) throw badRequest('Código ou segredo inválido.');
    const connected = githubFlows.redeem(code, verifier);
    if (!connected) throw badRequest('Código vencido ou já usado.');
    const userId = currentUser(req).id;
    await links.save(userId, connected);
    // Sem nenhum repositório liberado ainda: o app manda o navegador para a instalação.
    const installed = await installationCount(connected.tokens.accessToken).catch(() => 1);
    res.json({ login: connected.login, installed: installed > 0, installUrl });
  });

  router.get('/github/repos', authed, async (req, res) => {
    await withToken(currentUser(req).id, res, async (token) => {
      res.json({ repos: await listRepos(token) });
    });
  });

  router.get('/github/installations', authed, async (req, res) => {
    await withToken(currentUser(req).id, res, async (token) => {
      res.json({ installations: await listInstallations(token) });
    });
  });

  router.post('/github/token', authed, async (req, res) => {
    await withToken(currentUser(req).id, res, async (token, expiresAt) => {
      res.set('Cache-Control', 'no-store').json({ token, expiresAt: expiresAt?.getTime() ?? null });
    });
  });

  router.delete('/github', authed, async (req, res) => {
    await links.remove(currentUser(req).id, githubAppEnabled(config));
    res.status(204).end();
  });

  return router;
};
