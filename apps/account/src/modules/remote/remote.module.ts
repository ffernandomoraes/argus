import { eq } from 'drizzle-orm';
import { Router } from 'express';

import { badRequest, notFound } from '../../errors';
import { currentSession, currentUser } from '../../middlewares/requireAuth';
import { desktopDevice } from '../desktop/desktop.table';
import type { ApiModule } from '../types';
import { aliveSessions, HOST_ID, hostIdOf, listHosts, otherHost, parseHost, publishHost, unpublishHost } from './remote.service';
import { PairTickets } from './remote.tickets';

// Acesso remoto pela conta (ver remote.table.ts e remote.tickets.ts).
// PUT    /api/remote/host    { hostId, code, expiresAt }: este computador aceita acesso pela conta
// DELETE /api/remote/host    não aceita mais
// GET    /api/remote/hosts   os outros computadores da conta que aceitam, com o código de cada um
// POST   /api/remote/ticket  { hostId }: bilhete para parear com um deles (vai junto no pareamento)
// POST   /api/remote/claim   { ticket }: o computador troca o bilhete pela sessão de quem pareou
// POST   /api/remote/check   { ids, seen? }: das sessões dos pareados pela conta, as que ainda valem

const MAX_CHECK = 200;

const strings = (v: unknown, max: number): string[] | null =>
  Array.isArray(v) && v.length <= max && v.every((s) => typeof s === 'string' && s.length <= 100) ? (v as string[]) : null;

export const remoteModule: ApiModule = ({ db, authed }) => {
  const router = Router();
  const tickets = new PairTickets();

  router.put('/remote/host', authed, async (req, res) => {
    const host = parseHost(req.body);
    if (typeof host === 'string') throw badRequest(host);
    await publishHost(db, currentUser(req).id, currentSession(req).id, host);
    res.status(204).end();
  });

  router.delete('/remote/host', authed, async (req, res) => {
    await unpublishHost(db, currentSession(req).id);
    res.status(204).end();
  });

  router.get('/remote/hosts', authed, async (req, res) => {
    res.json({ hosts: await listHosts(db, currentUser(req).id, currentSession(req).id) });
  });

  router.post('/remote/ticket', authed, async (req, res) => {
    const hostId = (req.body as Record<string, unknown> | undefined)?.hostId;
    if (typeof hostId !== 'string' || !HOST_ID.test(hostId)) throw badRequest('invalid hostId');
    const userId = currentUser(req).id;
    const sessionId = currentSession(req).id;
    if (!(await otherHost(db, userId, sessionId, hostId))) throw notFound('Esse computador não está aceitando conexões pela conta.');
    res.json({ ticket: tickets.issue({ userId, sessionId, hostId }) });
  });

  router.post('/remote/claim', authed, async (req, res) => {
    const value = (req.body as Record<string, unknown> | undefined)?.ticket;
    if (typeof value !== 'string' || value.length > 100) throw badRequest('invalid ticket');
    const ticket = tickets.claim(value);
    const hostId = ticket ? await hostIdOf(db, currentSession(req).id) : null;
    if (!ticket || ticket.userId !== currentUser(req).id || hostId !== ticket.hostId) throw notFound('Bilhete inválido.');
    // Quem pediu pode ter saído da conta nesse meio.
    const [device] = await db
      .select({ name: desktopDevice.name, platform: desktopDevice.platform })
      .from(desktopDevice)
      .where(eq(desktopDevice.sessionId, ticket.sessionId))
      .limit(1);
    if (!device) throw notFound('Bilhete inválido.');
    res.json({ sessionId: ticket.sessionId, name: device.name, platform: device.platform });
  });

  router.post('/remote/check', authed, async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const ids = strings(body.ids, MAX_CHECK);
    const seen = body.seen === undefined ? [] : strings(body.seen, MAX_CHECK);
    if (!ids || !seen) throw badRequest('invalid ids');
    res.json({ alive: await aliveSessions(db, currentUser(req).id, { ids, seen }) });
  });

  return router;
};
