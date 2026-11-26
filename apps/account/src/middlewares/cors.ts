import type { RequestHandler } from 'express';

import { WEB_APP_ALIASES, type Config } from '../config';

// O app do celular roda no navegador, em outra origem (a ponte do acesso remoto): só ele pode chamar
// a API de lá. O login vai no cabeçalho Authorization (nunca em cookie), então o navegador pergunta
// antes (OPTIONS). Também o mesmo app pelo endereço do Worker (WEB_APP_ALIASES). Fora de produção, o
// app do celular em desenvolvimento (localhost) também.
export function cors(config: Config): RequestHandler {
  const allowed = (origin: string) =>
    origin === config.WEB_APP_URL || WEB_APP_ALIASES.includes(origin) || (config.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin));
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (!origin || !allowed(origin)) {
      // Diagnóstico: uma pergunta do navegador recusada aparece no registro (com a origem e o que pediu),
      // para achar quem não consegue chamar a API (ex.: o app do celular aberto por outro endereço).
      if (req.method === 'OPTIONS') {
        console.warn(`[account] CORS recusado: origem ${JSON.stringify(String(origin ?? 'nenhuma').slice(0, 100))} em ${req.path.slice(0, 60)}`);
        return void res.status(204).end();
      }
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
