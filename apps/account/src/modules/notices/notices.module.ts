import { eq } from 'drizzle-orm';
import { Router, type Response } from 'express';

import { badRequest, serviceUnavailable } from '../../errors';
import { currentSession, currentUser } from '../../middlewares/requireAuth';
import { desktopDevice } from '../desktop/desktop.table';
import type { ApiModule } from '../types';
import { noticeHub as hub, type Listener, type Notice } from './notices.hub';

// Avisos entre os computadores da conta: uma conversa terminou (ou precisa de você, ou deu erro) num
// computador sem ninguém na frente, e o aviso aparece nos outros que estão ligados. O servidor só
// repassa: não guarda título nem texto.
// GET  /api/notices/stream  fluxo (Server-Sent Events) com os avisos dos outros computadores
// POST /api/notices         { title, body, kind, hostId? }: manda para os outros computadores

const KEEPALIVE_MS = 25_000;
// Computador que não lê o fluxo: passando disto parado na fila, a ligação cai (a memória não cresce).
const MAX_BUFFERED_BYTES = 64 * 1024;
const KINDS = new Set(['done', 'needs-you', 'error']);

const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);

// O fluxo de um computador para o hub: nunca escreve depois de fechado, e derruba a ligação de quem
// não lê.
function streamListener(sessionId: string, res: Response): Listener {
  const open = () => !res.writableEnded && !res.destroyed;
  return {
    sessionId,
    write(chunk) {
      if (!open()) return false;
      if (res.writableLength > MAX_BUFFERED_BYTES) {
        res.destroy();
        return false;
      }
      res.write(chunk);
      return true;
    },
    close() {
      if (open()) res.end();
    },
  };
}

export const noticesModule: ApiModule = ({ db, authed }) => {
  const router = Router();

  router.get('/notices/stream', authed, (req, res) => {
    const listener = streamListener(currentSession(req).id, res);
    const remove = hub.add(currentUser(req).id, listener);
    if (!remove) throw serviceUnavailable('Muitas ligações abertas agora. Tente de novo daqui a pouco.');
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.flushHeaders();
    listener.write(': ok\n\n');
    // Comentário de tempos em tempos: o proxy não derruba a ligação parada.
    const keepalive = setInterval(() => listener.write(': ping\n\n'), KEEPALIVE_MS);
    const cleanup = () => {
      clearInterval(keepalive);
      remove();
    };
    res.on('close', cleanup);
    // Sem quem ouça, um erro na escrita derrubaria o servidor inteiro.
    res.on('error', cleanup);
  });

  router.post('/notices', authed, async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = text(body.title, 300);
    const kind = typeof body.kind === 'string' && KINDS.has(body.kind) ? body.kind : null;
    if (!title || !kind) throw badRequest('Aviso inválido.');
    const session = currentSession(req);
    const [device] = await db.select({ name: desktopDevice.name }).from(desktopDevice).where(eq(desktopDevice.sessionId, session.id)).limit(1);
    const notice: Notice = {
      from: device?.name ?? 'Argus',
      title,
      body: text(body.body, 600) ?? '',
      kind,
      ...(text(body.hostId, 64) && { hostId: body.hostId as string }),
    };
    res.json({ sent: hub.send(currentUser(req).id, session.id, notice) });
  });

  return router;
};
