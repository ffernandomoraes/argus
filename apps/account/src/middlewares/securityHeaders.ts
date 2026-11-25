import type { RequestHandler } from 'express';

// Cabeçalhos de segurança em toda resposta. A única página daqui (o fim do login, ver
// desktop.pages.ts) só usa estilo e fonte embutidos. Padrão do codes-modules.

const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "style-src 'unsafe-inline'",
  'img-src data:',
  'font-src data:',
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.set({
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  });
  next();
};
