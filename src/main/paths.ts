import { realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import { IS_WIN } from './platform'

// "~/proj" (Mac) ou "~\proj" (Windows): o canvas guarda as pastas a partir da pasta do usuário.
export function expandHome(path: string): string {
  if (path === '~') return homedir()
  const tilde = path.startsWith('~/') || (IS_WIN && path.startsWith('~\\'))
  return tilde ? homedir() + path.slice(1) : path
}

// Resolve um caminho relativo dentro da raiz; recusa o que tentar sair dela (../). No Windows,
// também o que estiver em outro disco: lá o relative devolve o caminho absoluto ("D:\x"). Uma
// pasta que só começa com dois pontos ("..dados") é legítima: sair é ".." inteiro.
export function insideRoot(root: string, rel: string): string | null {
  const base = resolve(expandHome(root))
  const full = resolve(base, rel)
  const r = relative(base, full)
  const leaves = r === '..' || r.startsWith('..' + sep)
  return leaves || isAbsolute(r) || resolve(base, r) !== full ? null : full
}

// O lsof devolve a pasta real (sem atalhos); a do projeto precisa estar igual para comparar. No
// Windows, uma unidade mapeada vira o caminho de rede (\\servidor\pasta): quem compara com o que
// a pessoa abriu usa também o resolve simples (ver projectServers/matching.ts).
export function realRoot(path: string): string {
  const full = resolve(expandHome(path))
  try {
    return realpathSync.native(full)
  } catch {
    return full
  }
}

// A pasta é a raiz ou fica dentro dela.
export const inside = (root: string, dir: string): boolean => dir === root || dir.startsWith(root + sep)

// É uma pasta que existe? Nunca lança: entre conferir e usar, ela pode sumir ou ficar sem permissão.
export function isDirectory(path: string): boolean {
  try {
    return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false
  } catch {
    return false
  }
}
