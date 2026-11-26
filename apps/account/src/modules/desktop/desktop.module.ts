import { and, desc, eq, gt } from 'drizzle-orm';
import { Router } from 'express';

import { badRequest, notFound, unauthorized } from '../../errors';
import { currentSession, currentUser } from '../../middlewares/requireAuth';
import { session, user } from '../auth/auth.table';
import { profileOf } from '../profile/profile.service';
import { noticeHub } from '../notices/notices.hub';
import type { ApiModule } from '../types';
import { cleanDevice, isCode, isVerifier, redeemLoginCode, redeemWaitingLogin } from './desktop.codes';
import { desktopDevice } from './desktop.table';

// Sessão que saiu da conta: o fluxo de avisos dela fecha, e os outros computadores ficam sabendo
// (desfazem o acesso remoto que ela abriu pela conta).
function gone(userId: string, sessionId: string): void {
  noticeHub.closeSession(sessionId);
  noticeHub.broadcast(userId, 'device-removed', { id: sessionId });
}

// Rotas do app do computador:
// POST   /api/desktop/redeem  troca o código do fim do login (com o segredo) pela sessão do aparelho
// POST   /api/desktop/redeem-wait  o app do celular instalado pergunta, com o segredo, se o login
//                                    terminou (202: ainda não; ver /auth/web-confirm)
// POST   /api/logout          sai deste aparelho
// GET    /api/devices         aparelhos com a conta aberta
// DELETE /api/devices/<id>    tira um aparelho da conta (ele vê 401 no próximo pedido)
export const desktopModule: ApiModule = ({ db, auth, authed }) => {
  const router = Router();

  router.post('/desktop/redeem', async (req, res) => {
    const { code, verifier, device } = (req.body ?? {}) as Record<string, unknown>;
    if (!isCode(code) || !isVerifier(verifier)) throw badRequest('Código ou segredo inválido.');
    const userId = await redeemLoginCode(db, code, verifier);
    if (!userId) throw unauthorized('O código do login não vale mais. Entre de novo.');
    res.json(await deviceSession(userId, device));
  });

  router.post('/desktop/redeem-wait', async (req, res) => {
    const { verifier, device } = (req.body ?? {}) as Record<string, unknown>;
    if (!isVerifier(verifier)) throw badRequest('Segredo inválido.');
    const userId = await redeemWaitingLogin(db, verifier);
    if (userId === 'pending') {
      res.status(202).json({ pending: true });
      return;
    }
    if (!userId) throw unauthorized('O login demorou demais. Entre de novo.');
    res.json(await deviceSession(userId, device));
  });

  // A sessão do aparelho que acabou de entrar, com o nome dele na lista de aparelhos.
  async function deviceSession(userId: string, device: unknown) {
    const [owner] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
    if (!owner) throw unauthorized();
    const context = await auth.$context;
    const created = await context.internalAdapter.createSession(userId);
    const { name, platform } = cleanDevice(device);
    await db.insert(desktopDevice).values({ sessionId: created.id, name, platform });
    return { token: created.token, profile: await profileOf(db, owner) };
  }

  router.post('/logout', authed, async (req, res) => {
    const id = currentSession(req).id;
    await db.delete(session).where(eq(session.id, id));
    gone(currentUser(req).id, id);
    res.status(204).end();
  });

  router.get('/devices', authed, async (req, res) => {
    const me = currentSession(req);
    const rows = await db
      .select({ id: session.id, name: desktopDevice.name, platform: desktopDevice.platform, lastSeenAt: desktopDevice.lastSeenAt })
      .from(session)
      .innerJoin(desktopDevice, eq(desktopDevice.sessionId, session.id))
      .where(and(eq(session.userId, currentUser(req).id), gt(session.expiresAt, new Date())))
      .orderBy(desc(desktopDevice.lastSeenAt));
    res.json({ devices: rows.map((r) => ({ ...r, lastSeenAt: r.lastSeenAt.getTime(), current: r.id === me.id })) });
  });

  router.delete('/devices/:id', authed, async (req, res) => {
    const id = String(req.params.id);
    const removed = await db
      .delete(session)
      .where(and(eq(session.id, id), eq(session.userId, currentUser(req).id)))
      .returning({ id: session.id });
    if (!removed.length) throw notFound('Aparelho não encontrado.');
    gone(currentUser(req).id, id);
    res.status(204).end();
  });

  return router;
};
