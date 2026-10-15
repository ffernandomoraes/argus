import { stat } from 'node:fs/promises'
import { git } from '../gitBranch/git'
import { insideRoot } from '../paths'

// Link do chat com caminho encurtado ("conversation/header/X.tsx" em vez de "src/renderer/src/
// conversation/header/X.tsx"): o Claude às vezes cita a partir da pasta em que está mexendo.
// Devolve o caminho absoluto do arquivo: o próprio, se existir; senão o único do projeto que
// termina com esse trecho. Vários ou nenhum: nulo, e quem abre mostra o erro de sempre.
export async function locateFile(root: string, rel: string): Promise<string | null> {
  const direct = insideRoot(root, rel)
  if (!direct) return null
  if (await exists(direct)) return direct
  const tail = '/' + rel.replace(/\\/g, '/').replace(/^\.\//, '')
  let listed: string
  try {
    // Versionados e novos, sem o que o .gitignore esconde (node_modules, out...).
    listed = await git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return null
  }
  const found = [...new Set(listed.split('\0'))].filter((f) => ('/' + f).endsWith(tail))
  return found.length === 1 ? insideRoot(root, found[0]) : null
}

async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}
