import { Router } from 'express';

import { badRequest, notFound, tooLarge, tooManyRequests } from '../../errors';
import { HOUR_MS, RateLimiter } from '../../lib/rateLimiter';
import { currentSession, currentUser } from '../../middlewares/requireAuth';
import type { ApiModule } from '../types';
import { otherComputer, otherComputers, parseSnapshot, saveSnapshot } from './workspaces.service';

// PUT /api/workspaces { snapshot }: o desenho dos workspaces deste computador.
// GET /api/workspaces: os dos outros computadores da conta, só o resumo. GET /api/workspaces/:id: o
// desenho inteiro de um (para trazer).

// Envios por pessoa por hora, somando os computadores (cada envio troca o desenho inteiro de um).
export const WORKSPACE_SENDS_PER_HOUR = 20;

export const workspacesModule: ApiModule = ({ db, authed }) => {
  const router = Router();
  const sends = new RateLimiter(HOUR_MS, WORKSPACE_SENDS_PER_HOUR);

  router.put('/workspaces', authed, async (req, res) => {
    const snapshot = parseSnapshot(req.body);
    if (snapshot === 'too large' || snapshot === 'too many workspaces') throw tooLarge('Workspaces grandes demais para a conta.');
    if (typeof snapshot === 'string') throw badRequest(snapshot);
    const userId = currentUser(req).id;
    if (!sends.tryHit(userId)) {
      res.setHeader('Retry-After', String(Math.ceil(sends.retryAfterMs(userId) / 1000)));
      throw tooManyRequests(`No máximo ${WORKSPACE_SENDS_PER_HOUR} envios de workspaces por hora.`);
    }
    await saveSnapshot(db, userId, currentSession(req).id, snapshot);
    res.status(204).end();
  });

  router.get('/workspaces', authed, async (req, res) => {
    res.json({ computers: await otherComputers(db, currentUser(req).id, currentSession(req).id) });
  });

  router.get('/workspaces/:id', authed, async (req, res) => {
    const computer = await otherComputer(db, currentUser(req).id, currentSession(req).id, String(req.params.id));
    if (!computer) throw notFound('Esse computador não tem workspaces na conta.');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ computer });
  });

  return router;
};
