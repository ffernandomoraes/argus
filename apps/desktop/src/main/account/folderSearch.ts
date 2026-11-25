import { statSync } from 'node:fs';
import { opendir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { cloneUrl, folderName, isSafeFolderPath, localPath, normalizeRemote, type FolderHint } from '@argus/shared/accountWorkspaces';
import { expandHome } from '../paths';
import { IS_WIN } from '../platform';
import { parseWslPath } from '../wsl/path';

// Achar neste computador as pastas de um workspace trazido de outro (item 1e). Primeiro o mesmo
// caminho (dentro da pasta do usuário, "~/code/argus" vale nos dois); depois uma busca rápida nos
// lugares comuns, pelo mesmo repositório git ou pelo mesmo nome. O que não achar fica com o caminho
// de lá, e o card mostra "Pasta não encontrada" com "Localizar pasta…".

// Até onde a busca desce a partir da pasta do usuário ("~/a/b/c/projeto" é o fundo) e quanto tempo
// e quantas pastas ela olha, para não segurar a importação numa pasta pessoal enorme.
const MAX_DEPTH = 4;
const MAX_DIRS = 20_000;
const BUDGET_MS = 4_000;
// Pastas que nunca têm projeto (ou são enormes).
const SKIP = new Set([
  'node_modules', 'Library', 'Applications', 'AppData', 'Pictures', 'Music', 'Movies', 'Videos', 'Photos',
  'Public', 'vendor', 'dist', 'build', 'target', 'venv', '__pycache__', 'Pods', 'DerivedData',
]);

type Candidate = { path: string; name: string; git: boolean };

// O "origin" (ou o primeiro remote) do .git/config da pasta: normalizado, para comparar, e o
// endereço para clonar (sem usuário e senha). Nulo: não é repositório, ou o .git é de uma tarefa
// isolada (arquivo apontando para outro lugar).
export async function gitRemoteInfo(dir: string): Promise<{ remote: string; url: string | null } | null> {
  if (parseWslPath(dir)) return null;
  let text: string;
  try {
    text = await readFile(join(dir, '.git', 'config'), 'utf8');
  } catch {
    return null;
  }
  const sections = text.split(/^\s*\[/m);
  const remotes = sections.filter((s) => /^remote\s+"/.test(s));
  const origin = remotes.find((s) => s.startsWith('remote "origin"')) ?? remotes[0];
  const raw = origin ? /^\s*url\s*=\s*(.+)$/m.exec(origin)?.[1]?.trim() : undefined;
  const remote = raw ? normalizeRemote(raw) : null;
  return remote ? { remote, url: cloneUrl(raw!) } : null;
}

export const gitRemote = async (dir: string): Promise<string | null> => (await gitRemoteInfo(dir))?.remote ?? null;

// As pastas dos lugares comuns, até MAX_DEPTH abaixo da pasta do usuário. Não segue atalhos
// (links simbólicos) nem entra em pastas ocultas.
async function scan(home: string): Promise<Candidate[]> {
  const out = new Map<string, Candidate>();
  const started = Date.now();
  const queue: { dir: string; depth: number }[] = [{ dir: home, depth: 0 }];
  while (queue.length && out.size < MAX_DIRS && Date.now() - started < BUDGET_MS) {
    const { dir, depth } = queue.shift()!;
    let handle;
    try {
      handle = await opendir(dir);
    } catch {
      continue;
    }
    for await (const entry of handle) {
      if (entry.name === '.git') {
        const self = out.get(dir);
        if (self) self.git = true;
        continue;
      }
      if (!entry.isDirectory() || entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
      const path = join(dir, entry.name);
      out.set(path, { path, name: entry.name, git: false });
      if (depth + 1 < MAX_DEPTH) queue.push({ dir: path, depth: depth + 1 });
    }
  }
  return [...out.values()];
}

// As pastas com repositório git nos lugares comuns da pasta do usuário (o "neste computador" do
// Clonar do GitHub).
export async function scanGitFolders(home = homedir()): Promise<string[]> {
  return (await scan(home)).filter((c) => c.git).map((c) => c.path);
}

const isDir = (path: string): boolean => {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
};

// Procura as pastas de uma importação. Devolve, por caminho portátil, o caminho como o canvas
// daqui guarda ("~/…" ou absoluto); nulo: não achou com segurança.
export class FolderFinder {
  private candidates: Promise<Candidate[]> | null = null;
  private remotes = new Map<string, Promise<string | null>>();
  private readonly home = homedir();

  async find(portable: string, hint: FolderHint | undefined): Promise<string | null> {
    // Caminho de rede ou com caractere de controle nem é olhado (ver isSafeFolderPath).
    if (!isSafeFolderPath(portable)) return null;
    const here = localPath(portable, IS_WIN);
    if (isDir(expandHome(here))) return here;
    this.candidates ??= scan(this.home);
    const all = await this.candidates;
    const name = folderName(portable);
    if (hint?.remote) {
      const byRemote = await this.withRemote(all.filter((c) => c.git), hint.remote);
      if (byRemote.length === 1) return this.display(byRemote[0]!.path);
      if (byRemote.length > 1) {
        const sameName = byRemote.filter((c) => c.name === name);
        return sameName.length === 1 ? this.display(sameName[0]!.path) : null;
      }
    }
    const byName = all.filter((c) => c.name === name);
    if (byName.length === 1) return this.display(byName[0]!.path);
    if (byName.length > 1) {
      // Vários com o nome: vale o que também tem a mesma pasta de cima ("clientes/argus").
      const parent = folderName(portable.slice(0, -name.length));
      const sameParent = byName.filter((c) => basename(join(c.path, '..')) === parent);
      return sameParent.length === 1 ? this.display(sameParent[0]!.path) : null;
    }
    return null;
  }

  private async withRemote(list: Candidate[], remote: string): Promise<Candidate[]> {
    const checked = await Promise.all(
      list.map(async (c) => {
        if (!this.remotes.has(c.path)) this.remotes.set(c.path, gitRemote(c.path));
        return (await this.remotes.get(c.path)) === remote ? c : null;
      }),
    );
    return checked.filter((c): c is Candidate => c !== null);
  }

  // Dentro da pasta do usuário, o canvas guarda com "~".
  private display(path: string): string {
    if (path === this.home || !path.startsWith(this.home + (IS_WIN ? '\\' : '/'))) return path;
    return '~' + path.slice(this.home.length);
  }
}
