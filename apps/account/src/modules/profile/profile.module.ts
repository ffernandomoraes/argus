import { eq } from 'drizzle-orm';
import { Router } from 'express';

import { githubAppEnabled } from '../../config';
import { currentUser } from '../../middlewares/requireAuth';
import { user } from '../auth/auth.table';
import { GitHubLinks } from '../github/github.service';
import { noticeHub } from '../notices/notices.hub';
import type { ApiModule } from '../types';
import { profileOf } from './profile.service';

// GET /api/me: o perfil. DELETE /api/me: apaga a conta e tudo dela (logins, sessões, aparelhos e
// preferências saem juntos, pelas chaves estrangeiras), o pedido de apagar conta da LGPD. Antes, a
// autorização do GitHub conectado é desfeita lá (a linha some com a conta, e a chave junto).
export const profileModule: ApiModule = ({ db, config, authed }) => {
  const router = Router();
  const links = new GitHubLinks(db, config);

  router.get('/me', authed, async (req, res) => {
    res.json({ profile: await profileOf(db, currentUser(req)) });
  });

  router.delete('/me', authed, async (req, res) => {
    const userId = currentUser(req).id;
    if (githubAppEnabled(config)) await links.remove(userId, true);
    const deleted = await db.delete(user).where(eq(user.id, userId)).returning({ id: user.id });
    if (deleted.length) noticeHub.closeUser(userId);
    res.status(204).end();
  });

  return router;
};
