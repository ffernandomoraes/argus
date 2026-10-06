import { homedir } from 'node:os'
import { relative, resolve } from 'node:path'

export function expandHome(path: string): string {
  return path === '~' || path.startsWith('~/') ? homedir() + path.slice(1) : path
}

// Resolve um caminho relativo dentro da raiz; recusa o que tentar sair dela (../).
export function insideRoot(root: string, rel: string): string | null {
  const base = resolve(expandHome(root))
  const full = resolve(base, rel)
  const r = relative(base, full)
  return r.startsWith('..') || resolve(base, r) !== full ? null : full
}
