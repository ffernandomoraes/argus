import { isAbsolute } from 'node:path'
import { realpathSync } from 'node:fs'
import { isDirectory } from '../paths'
import { IS_WIN } from '../platform'

// Argumento com que o argus.cmd abre o app. Um só, com "=": o Windows pode mudar a ordem dos
// argumentos ao repassar para a instância aberta.
export const OPEN_FLAG = '--open='

export function openArg(argv: string[]): string | null {
  const arg = argv.find((a) => a.startsWith(OPEN_FLAG))
  return arg ? arg.slice(OPEN_FLAG.length) : null
}

// Pasta pedida pelo `argus .` no Windows: precisa existir e ser pasta. Volta com as maiúsculas
// como estão no disco, porque o Claude Code nomeia o histórico pelo caminho: "c:\proj" não acharia
// as conversas de "C:\Proj".
export function validFolder(path: string | null | undefined): string | null {
  if (!path || !isAbsolute(path) || !isDirectory(path)) return null
  try {
    return IS_WIN ? realpathSync.native(path) : path
  } catch {
    return null
  }
}
