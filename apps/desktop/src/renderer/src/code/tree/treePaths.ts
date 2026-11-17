import type { FileEntry } from '@argus/shared/files';
import type { UncommittedFile } from '@argus/shared/sessions';
import { relativeTo, untildify } from '../../platform';

// Caminhos da árvore: relativos à pasta do projeto, sempre com "/" ('' é a raiz).

export type Kind = UncommittedFile['kind'];

// Pasta com mudanças dentro: o tipo mais importante entre elas dá a cor, como no VS Code.
const KIND_RANK: Kind[] = ['!', 'M', 'R', 'D', 'A', 'U'];

export const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');

// O próprio item ou algo dentro dele.
export const inside = (path: string, dir: string) => path === dir || path.startsWith(dir + '/');

// Arquivos não comitados (caminhos absolutos do git) → caminho na árvore e tipo da mudança,
// com as pastas que os contêm. O que está fora da pasta do projeto fica de fora.
export function changesInTree(root: string, files: UncommittedFile[] | null): Map<string, Kind> {
  const out = new Map<string, Kind>();
  if (!files) return out;
  const base = untildify(root);
  for (const f of files) {
    const rel = relativeTo(f.path, base);
    if (!rel) continue;
    out.set(rel, f.kind);
    for (let dir = parentOf(rel); dir; dir = parentOf(dir)) {
      const current = out.get(dir);
      if (!current || KIND_RANK.indexOf(f.kind) < KIND_RANK.indexOf(current)) out.set(dir, f.kind);
    }
  }
  return out;
}

// Pastas abertas depois de renomear `from` para `to`: as de dentro vão junto.
export const renamedDirs = (dirs: ReadonlySet<string>, from: string, to: string): Set<string> =>
  new Set([...dirs].map((d) => (inside(d, from) ? to + d.slice(from.length) : d)));

// Pastas do caminho até o item criado com subpastas no nome ("src/novo.ts" dentro de `dir`).
export function dirsUpTo(path: string, dir: string): string[] {
  const out: string[] = [];
  let acc = '';
  for (const part of parentOf(path).split('/')) {
    acc = acc ? `${acc}/${part}` : part;
    if (acc && acc !== dir) out.push(acc);
  }
  return out;
}

// Caminhos à vista na árvore, de cima para baixo: o conteúdo de cada pasta aberta logo abaixo dela.
// Serve para o ⇧-clique escolher tudo entre dois itens.
export function visiblePaths(listings: Readonly<Record<string, FileEntry[]>>, expanded: ReadonlySet<string>, dir = ''): string[] {
  const out: string[] = [];
  for (const e of listings[dir] ?? []) {
    out.push(e.path);
    if (e.isDir && expanded.has(e.path)) out.push(...visiblePaths(listings, expanded, e.path));
  }
  return out;
}

// Os itens entre `from` e `to` (os dois inclusos), na ordem em que aparecem. Sem `from` à vista:
// só `to`.
export function pathsBetween(order: readonly string[], from: string | null, to: string): string[] {
  const a = from === null ? -1 : order.indexOf(from);
  const b = order.indexOf(to);
  if (a < 0 || b < 0) return [to];
  return order.slice(Math.min(a, b), Math.max(a, b) + 1);
}

// Só os de cima: com uma pasta e um item dela na seleção, mover ou excluir a pasta já leva o item.
export const outermost = (paths: Iterable<string>): string[] => {
  const all = [...paths];
  return all.filter((p) => !all.some((o) => o !== p && inside(p, o)));
};

// Onde um item fica depois de movido para `dir`.
export const movedTo = (path: string, dir: string): string => {
  const name = path.slice(path.lastIndexOf('/') + 1);
  return dir ? `${dir}/${name}` : name;
};
