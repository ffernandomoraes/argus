import type { UncommittedFile } from '../../../../shared/sessions'
import { relativeTo, untildify } from '../../platform'

// Caminhos da árvore: relativos à pasta do projeto, sempre com "/" ('' é a raiz).

export type Kind = UncommittedFile['kind']

// Pasta com mudanças dentro: o tipo mais importante entre elas dá a cor, como no VS Code.
const KIND_RANK: Kind[] = ['!', 'M', 'R', 'D', 'A', 'U']

export const parentOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')

// O próprio item ou algo dentro dele.
export const inside = (path: string, dir: string) => path === dir || path.startsWith(dir + '/')

// Arquivos não comitados (caminhos absolutos do git) → caminho na árvore e tipo da mudança,
// com as pastas que os contêm. O que está fora da pasta do projeto fica de fora.
export function changesInTree(root: string, files: UncommittedFile[] | null): Map<string, Kind> {
  const out = new Map<string, Kind>()
  if (!files) return out
  const base = untildify(root)
  for (const f of files) {
    const rel = relativeTo(f.path, base)
    if (!rel) continue
    out.set(rel, f.kind)
    for (let dir = parentOf(rel); dir; dir = parentOf(dir)) {
      const current = out.get(dir)
      if (!current || KIND_RANK.indexOf(f.kind) < KIND_RANK.indexOf(current)) out.set(dir, f.kind)
    }
  }
  return out
}

// Pastas abertas depois de renomear `from` para `to`: as de dentro vão junto.
export const renamedDirs = (dirs: ReadonlySet<string>, from: string, to: string): Set<string> =>
  new Set([...dirs].map((d) => (inside(d, from) ? to + d.slice(from.length) : d)))

// Pastas do caminho até o item criado com subpastas no nome ("src/novo.ts" dentro de `dir`).
export function dirsUpTo(path: string, dir: string): string[] {
  const out: string[] = []
  let acc = ''
  for (const part of parentOf(path).split('/')) {
    acc = acc ? `${acc}/${part}` : part
    if (acc && acc !== dir) out.push(acc)
  }
  return out
}
