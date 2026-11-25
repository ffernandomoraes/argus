import { createHash, randomUUID } from 'node:crypto';
import {
  hintCloneUrl,
  importNodes,
  localPath,
  MAX_SNAPSHOT_BYTES,
  portablePath,
  readBoardSummaries,
  readSnapshot,
  remapNodes,
  snapshotFolders,
  snapshotNodes,
  summarizeBoard,
  type AccountComputer,
  type FolderHint,
  type SnapshotBoard,
  type WorkspaceImportResult,
  type WorkspaceSnapshot,
} from '@argus/shared/accountWorkspaces';
import { expandHome } from '../paths';
import { IS_WIN } from '../platform';
import { syncWorkspace } from '../workspaces';
import { FolderFinder, gitRemoteInfo } from './folderSearch';
import { AccountHttpError } from './http';

// Workspaces na conta (item 1e): o desenho dos daqui vai para a conta sozinho (na rodada de
// sincronização, só quando muda), e um workspace de outro computador vem como cópia quando a pessoa
// pede ("Trazer", no Perfil). Regras dos blocos em packages/shared/src/accountWorkspaces.ts.

export type BoardSource = {
  everything(): { id: string; name: string; nodes: unknown }[]
  names(): string[]
  // Cria um workspace com estes blocos e devolve o id.
  create(name: string, nodes: unknown[]): string
};

type Request = <T>(path: string, method?: 'GET' | 'PUT', body?: unknown) => Promise<T | null>;

const PLATFORMS: Record<string, string> = { darwin: 'Mac', win32: 'Windows', linux: 'Linux' };

// O desenho de agora e o hash dele (para mandar só quando muda).
export async function buildSnapshot(source: BoardSource): Promise<{ snapshot: WorkspaceSnapshot; hash: string }> {
  const boards: SnapshotBoard[] = source.everything().map((b) => ({ id: b.id, name: b.name, nodes: snapshotNodes(b.nodes, portablePath) }));
  // Em ordem fixa: o hash só muda quando o desenho muda (não pela ordem das leituras do git).
  const all = [...new Set(boards.flatMap((b) => snapshotFolders(b.nodes)))].sort();
  const remotes = await Promise.all(all.map((path) => gitRemoteInfo(expandHome(localPath(path, IS_WIN)))));
  const folders: Record<string, FolderHint> = {};
  all.forEach((path, i) => {
    const info = remotes[i];
    folders[path] = info ? { remote: info.remote, ...(info.url && { url: info.url }) } : {};
  });
  const snapshot = { boards, folders };
  const hash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  return { snapshot, hash };
}

// O servidor aceita 20 envios por hora por pessoa, somando os computadores: daqui sai no máximo um
// a cada 3 minutos e, recusado pelo limite, o próximo só depois de 15. O que mudar nesse meio vai no
// envio seguinte (cada envio leva o desenho inteiro).
const SEND_EVERY_MS = 3 * 60_000;
const LIMITED_WAIT_MS = 15 * 60_000;
let nextSendAt = 0;

export function resetSendWait(): void {
  nextSendAt = 0;
}

// Manda o desenho se mudou desde o último envio (`sent`: o hash dele). Devolve o hash enviado, ou
// o mesmo quando não precisou ou não pôde agora. Grande demais para a conta (canvas enorme): não manda.
export async function uploadSnapshot(source: BoardSource, sent: string | null, request: Request, now = Date.now()): Promise<string | null> {
  if (now < nextSendAt) return sent;
  const { snapshot, hash } = await buildSnapshot(source);
  if (hash === sent) return sent;
  if (JSON.stringify(snapshot).length > MAX_SNAPSHOT_BYTES) {
    console.warn('[account] workspaces grandes demais para a conta; não foram enviados');
    return sent;
  }
  try {
    await request('/api/workspaces', 'PUT', { snapshot });
  } catch (err) {
    if (!(err instanceof AccountHttpError) || err.status !== 429) throw err;
    nextSendAt = now + LIMITED_WAIT_MS;
    return sent;
  }
  nextSendAt = now + SEND_EVERY_MS;
  return hash;
}

type RawComputer = { id?: unknown; name?: unknown; platform?: unknown; updatedAt?: unknown; boards?: unknown; snapshot?: unknown };

function readBase(raw: RawComputer): Omit<AccountComputer, 'boards'> | null {
  if (typeof raw.id !== 'string') return null;
  return {
    id: raw.id,
    name: typeof raw.name === 'string' ? raw.name : 'Argus',
    platform: typeof raw.platform === 'string' ? raw.platform : 'other',
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
  };
}

// Os outros computadores da conta, com o resumo dos workspaces de cada um (o servidor manda só o
// resumo; o de antes mandava o desenho inteiro). Workspace vazio não entra.
export async function listComputers(request: Request): Promise<AccountComputer[]> {
  const r = await request<{ computers?: RawComputer[] }>('/api/workspaces');
  return (Array.isArray(r?.computers) ? r.computers : []).flatMap((raw) => {
    const base = raw && typeof raw === 'object' ? readBase(raw) : null;
    if (!base) return [];
    const boards = Array.isArray(raw.boards) ? readBoardSummaries(raw.boards) : (readSnapshot(raw.snapshot)?.boards.map(summarizeBoard) ?? []);
    return [{ ...base, boards: boards.filter((b) => b.folders || b.groups || b.notes) }];
  });
}

function readComputer(raw: RawComputer): (Omit<AccountComputer, 'boards'> & { snapshot: WorkspaceSnapshot }) | null {
  const base = readBase(raw);
  const snapshot = readSnapshot(raw.snapshot);
  return base && snapshot ? { ...base, snapshot } : null;
}

// Nome que não repete um workspace daqui: "Trabalho" vira "Trabalho (Mac)", depois "Trabalho (Mac 2)".
function freeName(name: string, computer: Pick<AccountComputer, 'platform' | 'name'>, taken: string[]): string {
  if (!taken.includes(name)) return name;
  const base = `${name} (${PLATFORMS[computer.platform] ?? computer.name})`;
  let candidate = base;
  for (let i = 2; taken.includes(candidate); i++) candidate = `${base.slice(0, -1)} ${i})`;
  return candidate;
}

// Traz uma cópia do workspace `boardId` do computador `computerId`: ids novos, as pastas achadas
// aqui e, nos cards de várias pastas, uma pasta de workspace nova deste computador.
export async function importBoard(source: BoardSource, request: Request, computerId: string, boardId: string): Promise<WorkspaceImportResult> {
  const r = await request<{ computer?: RawComputer }>(`/api/workspaces/${encodeURIComponent(computerId)}`);
  const computer = r?.computer ? readComputer(r.computer) : null;
  const board = computer?.snapshot.boards.find((b) => b.id === boardId);
  if (!computer || !board) return { ok: false, error: 'notFound' };
  // Recortado de novo aqui: o que veio da conta não é confiável (ver importNodes).
  const nodes = importNodes(board.nodes);
  const finder = new FolderFinder();
  const paths = snapshotFolders(nodes);
  const found = new Map<string, string | null>();
  for (const p of paths) found.set(p, await finder.find(p, computer.snapshot.folders[p]));
  // Id novo com o mesmo prefixo do tipo ("g-", "p-", "n-"), como os criados no canvas.
  const newId = (old: string) => `${/^([a-zA-Z]+)-/.exec(old)?.[1] ?? 'n'}-${randomUUID()}`;
  const copy = remapNodes(nodes, newId, (p) => found.get(p) ?? null, (p) => localPath(p, IS_WIN));
  // Pasta não achada, pelo caminho que ficou no card: o endereço para clonar, se for repositório.
  const missingHint = new Map(paths.filter((p) => !found.get(p)).map((p) => [localPath(p, IS_WIN), computer.snapshot.folders[p]]));
  for (const node of copy.nodes) {
    const data = node.data as { folders?: unknown; path?: unknown; imported?: boolean; cloneUrl?: string } | undefined;
    if (node.type !== 'project' || !data) continue;
    if (!Array.isArray(data.folders)) {
      if (typeof data.path !== 'string' || !missingHint.has(data.path)) continue;
      data.imported = true;
      const url = hintCloneUrl(missingHint.get(data.path));
      if (url) data.cloneUrl = url;
      continue;
    }
    // A pasta do workspace (onde as conversas abrem) é deste computador: nasce uma nova.
    data.path = await syncWorkspace(data.folders.filter((f): f is string => typeof f === 'string'));
  }
  const name = freeName(board.name, computer, source.names());
  const id = source.create(name, copy.nodes);
  return { ok: true, board: id, name, folders: paths.length, missing: copy.missing };
}
