import type { RequestHandler, Router } from 'express';

import type { Config } from '../config';
import type { Database } from '../db/client';
import type { Auth } from './auth/auth';

// Cada módulo monta as rotas dele em cima de /api (ver modules/index.ts). authed: exige a sessão.
export interface ModuleContext {
  config: Config
  db: Database
  auth: Auth
  authed: RequestHandler
}

export type ApiModule = (context: ModuleContext) => Router;
