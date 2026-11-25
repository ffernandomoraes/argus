import { and, eq, gt, inArray, ne } from 'drizzle-orm';

import type { Database } from '../../db/client';
import { SESSION_DAYS } from '../auth/auth';
import { session } from '../auth/auth.table';
import { desktopDevice } from '../desktop/desktop.table';
import { remoteHost } from './remote.table';

// O código de pareamento é o mesmo que a pessoa digitaria ("K7Q4M-913776"): 5 letras e números, hífen,
// 6 números. A sala é o id do computador na ponte.
const CODE = /^[A-Z0-9]{5}-\d{6}$/;
export const HOST_ID = /^[\w-]{8,64}$/;
// O código vale no máximo isto (o de casa renova antes).
const MAX_CODE_MS = 15 * 60_000;

export type HostWrite = { hostId: string; code: string; expiresAt: Date };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

// Corpo de PUT /api/remote/host: { hostId, code, expiresAt }. Texto: o motivo da recusa.
export function parseHost(body: unknown, now = Date.now()): HostWrite | string {
  if (!isRecord(body)) return 'invalid body';
  const { hostId, code, expiresAt } = body;
  if (typeof hostId !== 'string' || !HOST_ID.test(hostId)) return 'invalid hostId';
  if (typeof code !== 'string' || !CODE.test(code)) return 'invalid code';
  if (typeof expiresAt !== 'number' || expiresAt <= now || expiresAt > now + MAX_CODE_MS) return 'invalid expiresAt';
  return { hostId, code, expiresAt: new Date(expiresAt) };
}

export async function publishHost(db: Database, userId: string, sessionId: string, host: HostWrite): Promise<void> {
  const values = { hostId: host.hostId, code: host.code, codeExpiresAt: host.expiresAt };
  await db
    .insert(remoteHost)
    .values({ sessionId, userId, ...values })
    .onConflictDoUpdate({ target: remoteHost.sessionId, set: { ...values, updatedAt: new Date() } });
}

export async function unpublishHost(db: Database, sessionId: string): Promise<void> {
  await db.delete(remoteHost).where(eq(remoteHost.sessionId, sessionId));
}

export type HostView = { id: string; hostId: string; name: string; platform: string; code: string | null; updatedAt: number };

// Os computadores da pessoa com acesso remoto ligado, menos o que pergunta. Código vencido (o
// computador desligou ou perdeu a internet) vem nulo: aparece como indisponível.
export async function listHosts(db: Database, userId: string, sessionId: string, now = new Date()): Promise<HostView[]> {
  const rows = await db
    .select({
      id: remoteHost.sessionId,
      hostId: remoteHost.hostId,
      code: remoteHost.code,
      codeExpiresAt: remoteHost.codeExpiresAt,
      updatedAt: remoteHost.updatedAt,
      name: desktopDevice.name,
      platform: desktopDevice.platform,
    })
    .from(remoteHost)
    .leftJoin(desktopDevice, eq(desktopDevice.sessionId, remoteHost.sessionId))
    .where(and(eq(remoteHost.userId, userId), ne(remoteHost.sessionId, sessionId)));
  return rows
    .map((r) => ({
      id: r.id,
      hostId: r.hostId,
      name: r.name ?? 'Argus',
      platform: r.platform ?? 'other',
      code: r.codeExpiresAt > now ? r.code : null,
      updatedAt: r.updatedAt.getTime(),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// O computador da pessoa que publicou esta sala (`hostId`). Nulo: nenhum, ou é o próprio `sessionId`.
export async function otherHost(db: Database, userId: string, sessionId: string, hostId: string): Promise<{ sessionId: string } | null> {
  const [row] = await db
    .select({ sessionId: remoteHost.sessionId })
    .from(remoteHost)
    .where(and(eq(remoteHost.userId, userId), eq(remoteHost.hostId, hostId), ne(remoteHost.sessionId, sessionId)))
    .limit(1);
  return row ?? null;
}

// A sala que esta sessão publicou. Nula: ela não aceita acesso pela conta.
export async function hostIdOf(db: Database, sessionId: string): Promise<string | null> {
  const [row] = await db.select({ hostId: remoteHost.hostId }).from(remoteHost).where(eq(remoteHost.sessionId, sessionId)).limit(1);
  return row?.hostId ?? null;
}

// Das sessões `ids`, as que ainda valem e são aparelhos da pessoa. As de `seen` (que acabaram de entrar
// no computador pelo acesso remoto) contam como usadas agora: o fim da sessão vai para frente, como
// quando o aparelho fala com a conta, e o "usado há" da lista de aparelhos acompanha.
export async function aliveSessions(db: Database, userId: string, check: { ids: string[]; seen: string[] }, now = new Date()): Promise<string[]> {
  const { ids, seen } = check;
  if (!ids.length) return [];
  const rows = await db
    .select({ id: session.id })
    .from(session)
    .innerJoin(desktopDevice, eq(desktopDevice.sessionId, session.id))
    .where(and(eq(session.userId, userId), inArray(session.id, ids), gt(session.expiresAt, now)));
  const alive = rows.map((r) => r.id);
  const used = seen.filter((id) => alive.includes(id));
  if (used.length) {
    await db.update(session).set({ expiresAt: new Date(now.getTime() + SESSION_DAYS * 86_400_000) }).where(and(eq(session.userId, userId), inArray(session.id, used)));
    await db.update(desktopDevice).set({ lastSeenAt: now }).where(inArray(desktopDevice.sessionId, used));
  }
  return alive;
}
