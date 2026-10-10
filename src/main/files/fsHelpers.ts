import { lstat } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import type { FileOpResult } from '../../shared/files'
import { errorCode, errorMessage } from '../lib/errors'
import { expandHome } from '../paths'

// Caminho relativo à raiz, com "/", como a árvore usa.
export const relOf = (root: string, full: string): string => relative(resolve(expandHome(root)), full).split('\\').join('/')

export const exists = (full: string): Promise<boolean> =>
  lstat(full).then(
    () => true,
    () => false
  )

export const failure = (err: unknown): FileOpResult => {
  const code = errorCode(err)
  if (code === 'EEXIST') return { ok: false, error: 'Já existe um item com esse nome.' }
  if (code === 'ENOENT') return { ok: false, error: 'O item não existe mais.' }
  if (code === 'EACCES' || code === 'EPERM') return { ok: false, error: 'Sem permissão para isso.' }
  return { ok: false, error: errorMessage(err) }
}

export const OUTSIDE: FileOpResult = { ok: false, error: 'Caminho fora do projeto.' }
