import { and, asc, count, eq, gt, notInArray, sql } from 'drizzle-orm';

import type { Database } from '../../db/client';
import { lockUser } from '../../db/locks';
import { syncCounter, syncItem } from './sync.table';

// Preferências sincronizadas. Vence a última gravação que chega: cada uma ganha a versão seguinte da
// pessoa, e o app pede só o que tem versão maior que a última que viu. O servidor não sabe o que cada
// preferência é: quem confere os valores é o app, ao aplicar (regras em
// packages/shared/src/accountSync.ts).

export type SyncItem = { key: string; value: unknown };

const KEY = /^[a-z][A-Za-z0-9.]{0,63}$/;
// Em caracteres do JSON. Preferência é coisa pequena (a maior é a dos padrões da conversa).
const MAX_VALUE = 32 * 1024;
const MAX_ITEMS_PER_WRITE = 50;
export const MAX_KEYS = 200;

// Corpo de PUT /api/sync: { items: { chave: valor } }. Texto: o motivo da recusa.
export function parseWrite(body: unknown): Map<string, unknown> | string {
  const items = body && typeof body === 'object' ? (body as { items?: unknown }).items : undefined;
  if (!items || typeof items !== 'object' || Array.isArray(items)) return 'invalid items';
  const entries = Object.entries(items);
  if (entries.length === 0 || entries.length > MAX_ITEMS_PER_WRITE) return 'invalid item count';
  const out = new Map<string, unknown>();
  for (const [key, value] of entries) {
    if (!KEY.test(key)) return `invalid key: ${key.slice(0, 70)}`;
    if (value === null || value === undefined) return `missing value: ${key}`;
    if (JSON.stringify(value).length > MAX_VALUE) return `value too large: ${key}`;
    out.set(key, value);
  }
  return out;
}

// O que mudou depois de `since`, e a versão de agora. A versão é lida antes: uma gravação no meio
// aparece de novo na próxima leitura (o app aplica de novo, sem efeito), mas nunca se perde.
export async function readSync(db: Database, userId: string, since: number): Promise<{ items: SyncItem[]; version: number }> {
  const [counter] = await db.select({ version: syncCounter.version }).from(syncCounter).where(eq(syncCounter.userId, userId));
  const items = await db
    .select({ key: syncItem.key, value: syncItem.value })
    .from(syncItem)
    .where(and(eq(syncItem.userId, userId), gt(syncItem.version, since)))
    .orderBy(asc(syncItem.version));
  return { items, version: counter?.version ?? 0 };
}

// Grava e devolve a versão nova. Nulo: passaria do limite de preferências por pessoa. A pessoa fica
// travada até o fim da transação (lockUser): duas gravações ao mesmo tempo saem em ordem, e a conta do
// limite vale até a gravação.
export function writeSync(db: Database, userId: string, items: Map<string, unknown>): Promise<number | null> {
  const keys = [...items.keys()];
  return db.transaction(async (tx) => {
    await lockUser(tx, userId);
    const [others] = await tx
      .select({ n: count() })
      .from(syncItem)
      .where(and(eq(syncItem.userId, userId), notInArray(syncItem.key, keys)));
    if ((others?.n ?? 0) + keys.length > MAX_KEYS) return null;
    const [counter] = await tx
      .insert(syncCounter)
      .values({ userId, version: 1 })
      .onConflictDoUpdate({ target: syncCounter.userId, set: { version: sql`${syncCounter.version} + 1` } })
      .returning({ version: syncCounter.version });
    const version = counter?.version ?? 1;
    await tx
      .insert(syncItem)
      .values(keys.map((key) => ({ userId, key, value: items.get(key), version })))
      .onConflictDoUpdate({
        target: [syncItem.userId, syncItem.key],
        set: { value: sql`excluded.value`, version: sql`excluded.version`, updatedAt: new Date() },
      });
    return version;
  });
}
