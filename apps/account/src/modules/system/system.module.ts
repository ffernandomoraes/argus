import { Router } from 'express';

import type { ApiModule } from '../types';

// GET /api/health: o healthcheck da Railway.
export const systemModule: ApiModule = () => {
  const router = Router();
  router.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  return router;
};
