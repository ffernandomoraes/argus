import { randomUUID } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { AddFolderResult, FolderListing } from '@argus/shared/phoneChannels';
import { canvasPages } from './app/canvasRegistry';
import type { Boards } from './boards';
import { tr } from './i18n';
import { sendTo } from './ipc/events';
import { isRemotePage } from './ipc/page';

// O app do celular mexendo no canvas: navegar pelas pastas do computador e adicionar uma pasta a
// um workspace. O encaixe (dentro do grupo, o grupo crescendo, os vizinhos se afastando) é o mesmo
// de quando se adiciona pela janela: uma janela do canvas calcula (ver renderer/canvas/usePhoneFolders)
// e daqui o workspace é gravado e vai para todas as janelas. Sem janela aberta, não dá.

const PLACE_TIMEOUT_MS = 10_000;
const pending = new Map<string, (nodes: unknown, error: string | null) => void>();

const expandHome = (path: string) => (path === '~' || path.startsWith('~/') ? join(homedir(), path.slice(1)) : path);

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

// Subpastas visíveis (sem as ocultas), em ordem alfabética. Sem pasta: a pessoal.
export function folderListing(path: string | null): FolderListing | null {
  const dir = resolve(expandHome(path || homedir()));
  try {
    const folders = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => ({ name: d.name, path: join(dir, d.name) }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    const parent = dirname(dir);
    return { path: dir, parent: parent === dir ? null : parent, folders };
  } catch {
    return null;
  }
}

export async function addFolderFromPhone(boards: Boards, board: string, path: string, groupId: string | null): Promise<AddFolderResult> {
  const hub = boards.hub(board);
  if (!hub) return { ok: false, error: tr('Esse workspace não existe mais.', 'That workspace no longer exists.') };
  const folder = resolve(expandHome(String(path)));
  if (!isDir(folder)) return { ok: false, error: tr('Essa pasta não existe no computador.', "That folder doesn't exist on the computer.") };
  const pages = canvasPages().filter((p) => !isRemotePage(p) && !p.isDestroyed());
  if (!pages.length) return { ok: false, error: tr('Abra o Argus no computador para adicionar a pasta.', 'Open Argus on the computer to add the folder.') };
  const id = randomUUID();
  const { nodes, error } = await new Promise<{ nodes: unknown; error: string | null }>((done) => {
    const timer = setTimeout(() => finish(null, tr('O Argus no computador não respondeu.', 'Argus on the computer did not answer.')), PLACE_TIMEOUT_MS);
    function finish(n: unknown, e: string | null): void {
      clearTimeout(timer);
      pending.delete(id);
      done({ nodes: n, error: e });
    }
    pending.set(id, finish);
    // Todas as janelas do canvas calculam igual; vale a primeira resposta.
    const request = { id, nodes: hub.load(), path: folder, groupId: typeof groupId === 'string' ? groupId : null };
    for (const page of pages) sendTo(page, 'canvas:placeFolder', request);
  });
  if (error || !Array.isArray(nodes)) return { ok: false, error: error ?? tr('Não deu para adicionar a pasta.', "Couldn't add the folder.") };
  hub.record();
  hub.sync(nodes, null);
  return { ok: true };
}

// Resposta da janela do canvas.
export function folderPlaced(id: unknown, nodes: unknown, error: unknown): void {
  if (typeof id === 'string') pending.get(id)?.(nodes, typeof error === 'string' ? error : null);
}
