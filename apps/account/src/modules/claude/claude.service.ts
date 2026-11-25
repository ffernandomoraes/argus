import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';

import type { Database } from '../../db/client';
import { lockUser } from '../../db/locks';
import { type FileWrite, MAX_FILES, MAX_TOTAL_BYTES } from './claude.rules';
import { claudeFile } from './claude.table';

export type FileMeta = { path: string; hash: string; size: number; updatedAt: number };

export async function listFiles(db: Database, userId: string): Promise<FileMeta[]> {
  const rows = await db
    .select({ path: claudeFile.path, hash: claudeFile.hash, size: claudeFile.size, updatedAt: claudeFile.updatedAt })
    .from(claudeFile)
    .where(eq(claudeFile.userId, userId));
  return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.getTime() })).sort((a, b) => a.path.localeCompare(b.path));
}

export function readFiles(db: Database, userId: string, paths: string[]): Promise<{ path: string; content: string }[]> {
  return db
    .select({ path: claudeFile.path, content: claudeFile.content })
    .from(claudeFile)
    .where(and(eq(claudeFile.userId, userId), inArray(claudeFile.path, paths)));
}

// Grava (troca a versão dos que já existem). Falso: passaria do limite de arquivos ou de tamanho
// da pessoa. Conta numa transação: dois envios ao mesmo tempo não passam juntos do limite.
export function writeFiles(db: Database, userId: string, files: FileWrite[]): Promise<boolean> {
  const paths = files.map((f) => f.path);
  return db.transaction(async (tx) => {
    // A conta abaixo vale até a gravação (ver lockUser).
    await lockUser(tx, userId);
    const [others] = await tx
      .select({ n: sql<number>`count(*)::int`, bytes: sql<number>`coalesce(sum(${claudeFile.size}), 0)::int` })
      .from(claudeFile)
      .where(and(eq(claudeFile.userId, userId), notInArray(claudeFile.path, paths)));
    const bytes = (others?.bytes ?? 0) + files.reduce((sum, f) => sum + f.size, 0);
    if ((others?.n ?? 0) + files.length > MAX_FILES || bytes > MAX_TOTAL_BYTES) return false;
    await tx
      .insert(claudeFile)
      .values(files.map((f) => ({ userId, ...f })))
      .onConflictDoUpdate({
        target: [claudeFile.userId, claudeFile.path],
        set: { content: sql`excluded.content`, hash: sql`excluded.hash`, size: sql`excluded.size`, updatedAt: new Date() },
      });
    return true;
  });
}

export async function removeFiles(db: Database, userId: string, paths: string[]): Promise<void> {
  await db.delete(claudeFile).where(and(eq(claudeFile.userId, userId), inArray(claudeFile.path, paths)));
}
