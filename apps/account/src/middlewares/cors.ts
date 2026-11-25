import type { RequestHandler } from 'express';

import type { Config } from '../config';

// O app do celular roda no navegador, em outra origem (a ponte do acesso remoto): só ele pode chamar
// a API de lá. O login vai no cabeçalho Authorization (nunca em cookie), então o navegador pergunta
// antes (OPTIONS). Fora de produção, o app do celular em desenvolvimento (localhost) também.
export function cors(config: Config): RequestHandler {
  const allowed = (origin: string) =>
    origin === config.WEB_APP_URL || (config.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin));
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || !allowed(origin)) {
      if (req.method === 'OPTIONS') return void res.status(204).end();
      return next();
    }
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    });
    if (req.method === 'OPTIONS') return void res.status(204).end();
    next();
  };
}
