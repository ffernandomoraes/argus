import { Router } from 'express';

import { badRequest, tooLarge } from '../../errors';
import { currentUser } from '../../middlewares/requireAuth';
import type { ApiModule } from '../types';
import { parseWrite, readSync, writeSync } from './sync.service';

// GET /api/sync?since=N: preferências que mudaram depois da versão N, e a versão de agora.
// PUT /api/sync { items: { chave: valor } }: grava e devolve a versão nova.
export const syncModule: ApiModule = ({ db, authed }) => {
  const router = Router();

  router.get('/sync', authed, async (req, res) => {
    const since = Number(req.query.since ?? 0);
    res.json(await readSync(db, currentUser(req).id, Number.isInteger(since) && since >= 0 ? since : 0));
  });

  router.put('/sync', authed, async (req, res) => {
    const items = parseWrite(req.body);
    if (typeof items === 'string') throw badRequest(items);
    const version = await writeSync(db, currentUser(req).id, items);
    if (version === null) throw tooLarge('Preferências demais nesta conta.');
    res.json({ version });
  });

  return router;
};
