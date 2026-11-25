import { fromNodeHeaders } from 'better-auth/node';
import { eq } from 'drizzle-orm';
import type { Request, RequestHandler } from 'express';

import type { Database } from '../db/client';
import { unauthorized } from '../errors';
import type { Auth, AuthSession, AuthUser } from '../modules/auth/auth';
import { desktopDevice } from '../modules/desktop/desktop.table';

// Rotas de quem entrou: a sessão vem só do "Authorization: Bearer <token>" de um aparelho (o app do
// computador ou do celular, que ganha a sessão ao trocar o código do login em /api/desktop/redeem).
// O cookie fica de fora: a sessão do navegador existe só no meio do login, não abre a API, e assim
// nenhum site consegue usar a sessão de quem visita (CSRF).

// "Usado há X" na lista de aparelhos: grava no máximo uma vez por hora, não a cada pedido.
const SEEN_EVERY_MS = 3_600_000;

function touchDevice(db: Database, sessionId: string, now: Date): void {
  void db
    .update(desktopDevice)
    .set({ lastSeenAt: now })
    .where(eq(desktopDevice.sessionId, sessionId))
    .catch((error: unknown) => console.warn('[account] Não deu para marcar o aparelho como visto:', error));
}

export function requireAuth(auth: Auth, db: Database): RequestHandler {
  return async (req, _res, next) => {
    // Já conferido neste pedido (antes de ler um corpo grande, ver app.ts).
    if (req.user && req.session) return next();
    const headers = fromNodeHeaders(req.headers);
    headers.delete('cookie');
    if (!headers.get('authorization')) throw unauthorized();
    const found = await auth.api.getSession({ headers });
    if (!found) throw unauthorized();
    const [device] = await db
      .select({ lastSeenAt: desktopDevice.lastSeenAt })
      .from(desktopDevice)
      .where(eq(desktopDevice.sessionId, found.session.id))
      .limit(1);
    if (!device) throw unauthorized();
    req.user = found.user;
    req.session = found.session;
    const now = new Date();
    if (now.getTime() - device.lastSeenAt.getTime() > SEEN_EVERY_MS) touchDevice(db, found.session.id, now);
    next();
  };
}

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function currentSession(req: Request): AuthSession {
  if (!req.session) throw unauthorized();
  return req.session;
}
