import { and, desc, eq, ne, sql } from 'drizzle-orm';

import type { Database } from '../../db/client';
import { desktopDevice } from '../desktop/desktop.table';
import { deviceWorkspaces } from './workspaces.table';

// Workspaces de cada computador. O servidor só confere o formato por cima e o tamanho: quem entende os
// blocos é o app (packages/shared/src/accountWorkspaces.ts), que confere de novo ao trazer.

// Iguais aos do app (MAX_SNAPSHOT_BYTES e MAX_SNAPSHOT_BOARDS).
const MAX_BYTES = 1024 * 1024;
const MAX_BOARDS = 50;
const MAX_FOLDERS = 2000;
// Computadores na lista do Perfil (os que mandaram por último).
const MAX_COMPUTERS = 50;

// Resumo de um workspace para a lista (igual ao summarizeBoard do app).
export type BoardSummary = { id: string; name: string; folders: number; groups: number; notes: number };
type ComputerBase = { id: string; name: string; platform: string; updatedAt: number };
export type ComputerSummary = ComputerBase & { boards: BoardSummary[] };
export type Computer = ComputerBase & { snapshot: unknown };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

type Board = { id: string; name: string; nodes: unknown[] };
export type Snapshot = { boards: Board[]; folders: Record<string, unknown> };

// Corpo de PUT /api/workspaces: { snapshot: { boards: [{ id, name, nodes }], folders: {} } }. Texto:
// o motivo da recusa.
export function parseSnapshot(body: unknown): Snapshot | string {
  const snapshot = isRecord(body) ? body.snapshot : undefined;
  if (!isRecord(snapshot) || !Array.isArray(snapshot.boards)) return 'invalid snapshot';
  if (snapshot.boards.length > MAX_BOARDS) return 'too many workspaces';
  for (const b of snapshot.boards) {
    if (!isRecord(b) || typeof b.id !== 'string' || b.id.length > 64 || typeof b.name !== 'string' || b.name.length > 200) {
      return 'invalid workspace';
    }
    if (!Array.isArray(b.nodes)) return 'invalid workspace';
  }
  if (snapshot.folders !== undefined && (!isRecord(snapshot.folders) || Object.keys(snapshot.folders).length > MAX_FOLDERS)) {
    return 'invalid folders';
  }
  if (JSON.stringify(snapshot).length > MAX_BYTES) return 'too large';
  return { boards: snapshot.boards as Board[], folders: (snapshot.folders as Record<string, unknown> | undefined) ?? {} };
}

// Pastas (as dos cards e as de dentro dos cards de várias pastas, sem repetir), grupos e notas.
export function summarizeBoard(board: Board): BoardSummary {
  const folders = new Set<string>();
  let groups = 0;
  let notes = 0;
  for (const n of board.nodes) {
    if (!isRecord(n)) continue;
    if (n.type === 'area') groups++;
    if (n.type === 'note') notes++;
    if (n.type !== 'project' || !isRecord(n.data)) continue;
    if (Array.isArray(n.data.folders)) {
      for (const f of n.data.folders) if (typeof f === 'string') folders.add(f);
    } else if (typeof n.data.path === 'string') folders.add(n.data.path);
  }
  return { id: board.id, name: board.name, folders: folders.size, groups, notes };
}

export async function saveSnapshot(db: Database, userId: string, sessionId: string, snapshot: Snapshot): Promise<void> {
  const summary = snapshot.boards.map(summarizeBoard);
  await db
    .insert(deviceWorkspaces)
    .values({ sessionId, userId, snapshot, summary })
    .onConflictDoUpdate({ target: deviceWorkspaces.sessionId, set: { snapshot, summary, updatedAt: new Date() } });
}

const computerFields = {
  id: deviceWorkspaces.sessionId,
  updatedAt: deviceWorkspaces.updatedAt,
  name: desktopDevice.name,
  platform: desktopDevice.platform,
};

const base = (r: { id: string; updatedAt: Date; name: string | null; platform: string | null }): ComputerBase => ({
  id: r.id,
  name: r.name ?? 'Argus',
  platform: r.platform ?? 'other',
  updatedAt: r.updatedAt.getTime(),
});

// Resumo vindo do banco; linha antiga (sem resumo) resume o desenho.
function boardsOf(summary: unknown, snapshot: unknown): BoardSummary[] {
  if (Array.isArray(summary)) return summary as BoardSummary[];
  const parsed = parseSnapshot({ snapshot });
  return typeof parsed === 'string' ? [] : parsed.boards.map(summarizeBoard);
}

// Os outros computadores da pessoa que mandaram workspaces, só com o resumo (o desenho inteiro de
// todos de uma vez pesava na memória do servidor).
export async function otherComputers(db: Database, userId: string, sessionId: string): Promise<ComputerSummary[]> {
  const rows = await db
    .select({
      ...computerFields,
      summary: deviceWorkspaces.summary,
      // O desenho só das linhas sem resumo.
      legacy: sql<unknown>`case when ${deviceWorkspaces.summary} is null then ${deviceWorkspaces.snapshot} end`,
    })
    .from(deviceWorkspaces)
    .leftJoin(desktopDevice, eq(desktopDevice.sessionId, deviceWorkspaces.sessionId))
    .where(and(eq(deviceWorkspaces.userId, userId), ne(deviceWorkspaces.sessionId, sessionId)))
    .orderBy(desc(deviceWorkspaces.updatedAt))
    .limit(MAX_COMPUTERS);
  return rows.map((r) => ({ ...base(r), boards: boardsOf(r.summary, r.legacy) }));
}

// O desenho inteiro de um outro computador da pessoa (para trazer um workspace).
export async function otherComputer(db: Database, userId: string, sessionId: string, id: string): Promise<Computer | null> {
  const [row] = await db
    .select({ ...computerFields, snapshot: deviceWorkspaces.snapshot })
    .from(deviceWorkspaces)
    .leftJoin(desktopDevice, eq(desktopDevice.sessionId, deviceWorkspaces.sessionId))
    .where(and(eq(deviceWorkspaces.userId, userId), ne(deviceWorkspaces.sessionId, sessionId), eq(deviceWorkspaces.sessionId, id)))
    .limit(1);
  return row ? { ...base(row), snapshot: row.snapshot } : null;
}
