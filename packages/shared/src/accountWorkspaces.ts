// Workspaces na conta do Argus (item 1e): cada computador manda para a conta o desenho dos
// workspaces dele (grupos, cards de pasta, notas, cores e posições), e outro computador traz uma
// cópia quando quiser ("Trazer"). Depois de trazida, a cópia é independente. Terminais, conversas e
// tarefas isoladas ficam de fora: são da máquina. Aqui ficam as regras puras; quem lê os arquivos e
// procura as pastas é o app (apps/desktop/src/main/account/workspaces*.ts).

// Um workspace como vai para a conta: os blocos já recortados (snapshotNodes).
export type SnapshotBoard = { id: string; name: string; nodes: unknown[] };

// O que ajuda a achar a pasta noutro computador: o endereço do repositório git, normalizado
// (`remote`, para comparar) e como dá para clonar (`url`, sem usuário nem senha).
export type FolderHint = { remote?: string; url?: string };

export type WorkspaceSnapshot = {
  boards: SnapshotBoard[]
  // Por caminho portátil (portablePath).
  folders: Record<string, FolderHint>
};

// Resumo de um workspace de outro computador, para a lista do Perfil.
export type AccountBoardSummary = { id: string; name: string; folders: number; groups: number; notes: number };

// Outro computador da conta e os workspaces que ele mandou.
export type AccountComputer = {
  // Id do aparelho (a sessão dele na conta).
  id: string
  name: string
  // darwin, win32, linux ou other.
  platform: string
  updatedAt: number
  boards: AccountBoardSummary[]
};

export type WorkspaceImportResult =
  | { ok: true; board: string; name: string; folders: number; missing: number }
  | { ok: false; error: 'offline' | 'notFound' };

// Limites também conferidos pelo servidor.
export const MAX_SNAPSHOT_BYTES = 1024 * 1024;
export const MAX_SNAPSHOT_BOARDS = 50;

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

// Campos do bloco que vão junto: o resto (selecionado, arrastando, medido) é da tela.
const NODE_FIELDS = ['id', 'type', 'position', 'parentId', 'extent', 'width', 'height', 'style', 'hidden'] as const;
// Campos de `data` por tipo. Fica de fora a conta do Claude do grupo (é de cada computador) e o
// tamanho que o grupo tinha antes de crescer sozinho.
const DATA_FIELDS: Record<string, readonly string[]> = {
  area: ['label', 'color', 'collapsed', 'obscured', 'expandedSize'],
  project: ['name', 'path', 'color', 'folders', 'groupWide', 'collapsed'],
  note: ['text', 'color', 'width', 'collapsed'],
};

function pick(source: Raw, fields: readonly string[]): Raw {
  const out: Raw = {};
  for (const f of fields) if (source[f] !== undefined) out[f] = source[f];
  return out;
}

// Os blocos que vão para a conta, com os caminhos já portáteis. Tarefa isolada (worktree) não vai:
// a cópia da pasta é desta máquina. Bloco dentro de um grupo que não foi também fica de fora.
export function snapshotNodes(nodes: unknown, portable: (path: string) => string): unknown[] {
  if (!Array.isArray(nodes)) return [];
  const kept: Raw[] = [];
  for (const n of nodes) {
    if (!isRecord(n) || typeof n.id !== 'string' || typeof n.type !== 'string' || !isRecord(n.data)) continue;
    const fields = DATA_FIELDS[n.type];
    if (!fields || (n.type === 'project' && n.data.worktree)) continue;
    const data = pick(n.data, fields);
    if (n.type === 'project') {
      if (typeof data.path !== 'string') continue;
      data.path = portable(data.path);
      if (Array.isArray(data.folders)) data.folders = data.folders.filter((f) => typeof f === 'string').map((f) => portable(f as string));
    }
    kept.push({ ...pick(n, NODE_FIELDS), data });
  }
  const ids = new Set(kept.map((n) => n.id));
  return kept.filter((n) => typeof n.parentId !== 'string' || ids.has(n.parentId));
}

// As pastas de um workspace recortado: as dos cards e as de dentro dos cards de várias pastas.
export function snapshotFolders(nodes: unknown[]): string[] {
  const out = new Set<string>();
  for (const n of nodes) {
    if (!isRecord(n) || n.type !== 'project' || !isRecord(n.data)) continue;
    if (Array.isArray(n.data.folders)) {
      for (const f of n.data.folders) if (typeof f === 'string') out.add(f);
    } else if (typeof n.data.path === 'string') out.add(n.data.path);
  }
  return [...out];
}

export function summarizeBoard(board: SnapshotBoard): AccountBoardSummary {
  const count = (type: string) => board.nodes.filter((n) => isRecord(n) && n.type === type).length;
  return { id: board.id, name: board.name, folders: snapshotFolders(board.nodes).length, groups: count('area'), notes: count('note') };
}

// Caminho que vale em qualquer sistema: dentro da pasta do usuário vira "~/a/b" (com barra comum,
// também no Windows, onde o canvas guarda "~\a\b"); fora dela, fica como está.
export function portablePath(path: string): string {
  if (path === '~') return path;
  if (path.startsWith('~/') || path.startsWith('~\\')) return '~/' + path.slice(2).split(/[\\/]+/).filter(Boolean).join('/');
  return path;
}

// O caminho portátil no formato que o canvas deste sistema guarda.
export function localPath(path: string, windows: boolean): string {
  if (!path.startsWith('~/')) return path;
  return windows ? '~\\' + path.slice(2).split('/').join('\\') : path;
}

// O último nome do caminho ("~/code/argus" vira "argus").
export function folderName(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

// Endereço do repositório sem o que muda entre clones: "git@github.com:Ana/Argus.git" e
// "https://github.com/ana/argus" viram "github.com/ana/argus". Nulo: não parece um endereço.
export function normalizeRemote(url: string): string | null {
  let s = url.trim();
  if (!s) return null;
  const scp = /^[\w.-]+@([\w.-]+):(.+)$/.exec(s);
  if (scp) s = `${scp[1]}/${scp[2]}`;
  else {
    s = s.replace(/^[a-z+]+:\/\//i, '').replace(/^[^@/]+@/, '');
    s = s.replace(/^([\w.-]+):\d+\//, '$1/');
  }
  s = s.replace(/\.git\/?$/i, '').replace(/\/+$/, '');
  if (!/^[\w.-]+\/.+/.test(s)) return null;
  return s.toLowerCase();
}

// O endereço para clonar, sem o usuário e a senha que um endereço https pode carregar
// ("https://ana:token@github.com/x" vira "https://github.com/x"). Nulo: não é um endereço de clone.
export function cloneUrl(url: string): string | null {
  const s = url.trim();
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      u.username = '';
      u.password = '';
      return u.toString();
    } catch {
      return null;
    }
  }
  if (/^ssh:\/\//i.test(s) || /^[\w.-]+@[\w.-]+:[^\s]+$/.test(s)) return s;
  return null;
}

// Cópia de um workspace com ids novos (para não se misturar com blocos que já existem) e as pastas
// trocadas pelas deste computador. `resolve` devolve o caminho local; nulo: não achou, e o card
// fica com o caminho de lá no formato daqui (`unresolved`), mostrando "Pasta não encontrada", com
// "Localizar pasta…".
export function remapNodes(
  nodes: unknown[],
  newId: (oldId: string) => string,
  resolve: (path: string) => string | null,
  unresolved: (path: string) => string = (p) => p,
): { nodes: Raw[]; found: number; missing: number } {
  const ids = new Map<string, string>();
  for (const n of nodes) if (isRecord(n) && typeof n.id === 'string') ids.set(n.id, newId(n.id));
  const seen = new Map<string, string | null>();
  const local = (path: string): string | null => {
    if (!seen.has(path)) seen.set(path, resolve(path));
    return seen.get(path) ?? null;
  };
  const out: Raw[] = [];
  for (const n of nodes) {
    if (!isRecord(n) || typeof n.id !== 'string' || !isRecord(n.data)) continue;
    const data = { ...n.data };
    if (n.type === 'project') {
      if (Array.isArray(data.folders)) data.folders = data.folders.map((f) => (typeof f === 'string' ? (local(f) ?? unresolved(f)) : f));
      else if (typeof data.path === 'string') data.path = local(data.path) ?? unresolved(data.path);
    }
    const node: Raw = { ...n, id: ids.get(n.id), data };
    const parentId = typeof n.parentId === 'string' ? ids.get(n.parentId) : undefined;
    if (parentId) node.parentId = parentId;
    else delete node.parentId;
    out.push(node);
  }
  let found = 0;
  let missing = 0;
  for (const path of seen.values()) {
    if (path) found++;
    else missing++;
  }
  return { nodes: out, found, missing };
}

// Caminho de pasta vindo de outro computador que pode ser procurado e gravado aqui. Fica de fora:
// caractere de controle (uma quebra de linha entrava nas instruções do workspace, o CLAUDE.md da
// pasta dele), "..", endereço (smb://, file://) e pasta de rede: no Windows, só olhar
// \\servidor\pasta já manda a prova da senha da pessoa para o servidor; no Mac, /net monta sozinho.
// A pasta do WSL (\\wsl.localhost\<distro>, \\wsl$\<distro>) é deste computador e vale.
const MAX_PATH_LENGTH = 1024;
const WSL_UNC = /^[\\/]{2}(wsl\.localhost|wsl\$)[\\/][^\\/]+/i;
// Controle (\n, \r, \0...) e os que invertem o sentido do texto na tela.
const UNSAFE_CHARS = /[\p{Cc}\u202A-\u202E\u2066-\u2069]/u;

export function isSafeFolderPath(path: unknown): path is string {
  if (typeof path !== 'string' || !path || path.length > MAX_PATH_LENGTH || UNSAFE_CHARS.test(path)) return false;
  if (path.split(/[\\/]+/).includes('..')) return false;
  if (/^[\\/]{2}/.test(path) && !WSL_UNC.test(path)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return false;
  return !/^\/(net|Network)(\/|$)/.test(path);
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// Os blocos de um workspace de outro computador, recortados de novo aqui (o servidor ou quem tiver o
// token dele pode mandar qualquer coisa): só grupos, cards de pasta e notas, com os campos de cada um
// (nada de terminal, que abriria um processo), caminhos seguros (isSafeFolderPath) e posição e tamanho
// numéricos. Card sem pasta segura sai; card de várias pastas fica só com as seguras.
export function importNodes(nodes: unknown): unknown[] {
  const kept = snapshotNodes(nodes, (p) => p).flatMap((n) => {
    const node = { ...(n as Raw) };
    const data = { ...(node.data as Raw) };
    if (node.type === 'project') {
      if (Array.isArray(data.folders)) {
        data.folders = data.folders.filter(isSafeFolderPath);
        // A pasta do workspace (data.path) é trocada por uma nova daqui ao trazer.
        if (!(data.folders as string[]).length) return [];
      } else if (!isSafeFolderPath(data.path)) return [];
    }
    const position = isRecord(node.position) && isFiniteNumber(node.position.x) && isFiniteNumber(node.position.y) ? node.position : { x: 0, y: 0 };
    const out: Raw = { ...node, data, position: { x: position.x, y: position.y } };
    for (const k of ['width', 'height'] as const) if (out[k] !== undefined && !isFiniteNumber(out[k])) delete out[k];
    // Do estilo, só medidas: nada de imagem de fundo apontando para fora.
    if (out.style !== undefined) {
      const style = isRecord(out.style) ? Object.fromEntries(Object.entries(out.style).filter(([k, v]) => ['width', 'height', 'zIndex'].includes(k) && isFiniteNumber(v))) : {};
      out.style = style;
    }
    if (out.hidden !== undefined && typeof out.hidden !== 'boolean') delete out.hidden;
    if (out.extent !== undefined && out.extent !== 'parent') delete out.extent;
    return [out];
  });
  const ids = new Set(kept.map((n) => n.id));
  return kept.filter((n) => typeof n.parentId !== 'string' || ids.has(n.parentId));
}

// Endereço para clonar a pasta que não foi achada: o que veio de lá, se for um endereço de clone
// (cloneUrl), ou montado do repositório normalizado. Nulo: nenhum confiável.
export function hintCloneUrl(hint: FolderHint | undefined): string | null {
  if (hint?.url) {
    const url = cloneUrl(hint.url);
    if (url) return url;
  }
  if (hint?.remote && normalizeRemote(hint.remote) === hint.remote) return `https://${hint.remote}.git`;
  return null;
}

// Resumo de um workspace como o servidor manda na lista (sem o desenho inteiro), conferido.
export function readBoardSummaries(raw: unknown): AccountBoardSummary[] {
  if (!Array.isArray(raw)) return [];
  const count = (v: unknown) => (isFiniteNumber(v) && v >= 0 ? Math.floor(v) : 0);
  return raw.flatMap((b: unknown) =>
    isRecord(b) && typeof b.id === 'string' && typeof b.name === 'string'
      ? [{ id: b.id, name: b.name, folders: count(b.folders), groups: count(b.groups), notes: count(b.notes) }]
      : [],
  );
}

// Snapshot que veio do servidor, conferido (o app não confia no formato).
export function readSnapshot(raw: unknown): WorkspaceSnapshot | null {
  if (!isRecord(raw) || !Array.isArray(raw.boards)) return null;
  const boards: SnapshotBoard[] = raw.boards.flatMap((b: unknown) =>
    isRecord(b) && typeof b.id === 'string' && typeof b.name === 'string' && Array.isArray(b.nodes) ? [{ id: b.id, name: b.name, nodes: b.nodes }] : [],
  );
  const folders: Record<string, FolderHint> = {};
  if (isRecord(raw.folders)) {
    for (const [path, hint] of Object.entries(raw.folders)) {
      if (!isRecord(hint)) continue;
      folders[path] = {
        ...(typeof hint.remote === 'string' && { remote: hint.remote }),
        ...(typeof hint.url === 'string' && hint.url.length <= 500 && { url: hint.url }),
      };
    }
  }
  return { boards, folders };
}
