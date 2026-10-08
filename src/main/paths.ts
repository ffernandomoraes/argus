import { homedir } from 'node:os'
import { isAbsolute, relative, resolve } from 'node:path'
import { IS_WIN } from './platform'

// "~/proj" (Mac) ou "~\proj" (Windows): o canvas guarda as pastas a partir da pasta do usuário.
export function expandHome(path: string): string {
  if (path === '~') return homedir()
  const tilde = path.startsWith('~/') || (IS_WIN && path.startsWith('~\\'))
  return tilde ? homedir() + path.slice(1) : path
}

// Resolve um caminho relativo dentro da raiz; recusa o que tentar sair dela (../). No Windows,
// também o que estiver em outro disco: lá o relative devolve o caminho absoluto ("D:\x").
export function insideRoot(root: string, rel: string): string | null {
  const base = resolve(expandHome(root))
  const full = resolve(base, rel)
  const r = relative(base, full)
  return r.startsWith('..') || isAbsolute(r) || resolve(base, r) !== full ? null : full
}
