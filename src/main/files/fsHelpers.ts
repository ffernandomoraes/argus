import { lstat } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import type { FileOpResult } from '../../shared/files'
import { tr } from '../i18n'
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
  if (code === 'EEXIST') return nameTaken()
  if (code === 'ENOENT') return { ok: false, error: tr('O item não existe mais.', 'This item no longer exists.') }
  if (code === 'EACCES' || code === 'EPERM') return { ok: false, error: tr('Sem permissão para isso.', 'You don’t have permission to do that.') }
  return { ok: false, error: errorMessage(err) }
}

export const outside = (): FileOpResult => ({ ok: false, error: tr('Caminho fora do projeto.', 'Path is outside the project.') })

export const nameTaken = (): FileOpResult => ({
  ok: false,
  error: tr('Já existe um item com esse nome.', 'An item with that name already exists.')
})
