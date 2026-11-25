import { toNodeHandler } from 'better-auth/node';
import express, { type Express } from 'express';

import type { Config } from './config';
import type { Database } from './db/client';
import { byIp, MINUTE_MS, RateLimiter } from './lib/rateLimiter';
import { cors } from './middlewares/cors';
import { apiNotFound, errorHandler } from './middlewares/errorHandler';
import { rateLimit } from './middlewares/rateLimit';
import { requireAuth } from './middlewares/requireAuth';
import { securityHeaders } from './middlewares/securityHeaders';
import { apiModules } from './modules';
import type { Auth } from './modules/auth/auth';
import { browserRoutes } from './modules/desktop/desktop.browser';
import { githubBrowserRoutes } from './modules/github/github.browser';

// O servidor da conta do Argus (account.argusterm.com): o login do app do computador, os aparelhos
// e as preferências sincronizadas. Montado no padrão da API do codes-modules (api-core).

export interface AppContext {
  config: Config
  db: Database
  auth: Auth
}

export function createApp(context: AppContext): Express {
  const { config, db, auth } = context;
  const app = express();
  app.disable('x-powered-by');
  // Atrás do proxy da Railway: o IP de quem pediu vem do cabeçalho.
  const behindProxy = config.NODE_ENV === 'production';
  app.set('trust proxy', behindProxy ? 1 : false);

  app.use(securityHeaders);
  app.use(['/api', '/auth', '/github'], rateLimit(new RateLimiter(MINUTE_MS, config.RATE_LIMIT_PER_MINUTE), byIp(behindProxy)));
  // Cada começo de login ou de conexão do GitHub guarda um estado (no banco ou na memória): por IP,
  // poucos a cada 10 minutos, para ninguém encher a tabela nem empurrar para fora o de quem está no
  // meio do login.
  app.get(['/auth/:provider/start', '/auth/:provider/web', '/github/start'], rateLimit(new RateLimiter(10 * MINUTE_MS, config.STARTS_PER_10_MINUTES), byIp(behindProxy)));
  app.use('/api', cors(config));
  // Respostas da API são de uma pessoa: nada de cópia guardada no caminho.
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  // Do Better Auth, só a volta do GitHub e do Google fica aberta para a internet. O resto (listar
  // sessões, entrar por POST, trocar e-mail...) o servidor usa por dentro (auth.api): aberto, um token
  // vazado listava os tokens das outras sessões da conta.
  app.get('/api/auth/callback/:provider', toNodeHandler(auth));
  // Os workspaces e os arquivos do Claude chegam maiores que o resto (até 1 MB e 2 MB por envio, ver
  // os módulos); o leitor de cada um vem antes do geral, que pula o corpo já lido, e só depois de
  // conferir o login: quem não entrou não faz o servidor ler megabytes.
  const authed = requireAuth(auth, db);
  app.use('/api/workspaces', authed, express.json({ limit: '1200kb' }));
  app.use('/api/claude', authed, express.json({ limit: '3mb' }));
  app.use('/api', express.json({ limit: '256kb' }));

  app.use(browserRoutes(context));
  app.use(githubBrowserRoutes(context));
  const moduleContext = { ...context, authed };
  for (const createModule of apiModules) app.use('/api', createModule(moduleContext));

  app.use('/api', apiNotFound);
  app.use(errorHandler);
  return app;
}
