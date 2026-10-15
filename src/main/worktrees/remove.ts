import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { git } from '../gitBranch/git'
import { findRepo } from '../gitBranch/repo'
import { forgetStatus } from '../gitBranch/status'
import { tr } from '../i18n'
import { errorMessage } from '../lib/errors'
import { expandHome } from '../paths'
import { forgetWorktree, worktreeOf } from './store'

// Apaga a pasta do worktree; a branch fica, com os commits. Quem chama já confirmou com a pessoa o
// que se perde (o card mostra os arquivos não comitados e os commits não enviados). Reservado e
// ainda sem pasta: só esquece. Devolve o erro ou nulo.
export async function removeWorktree(path: string): Promise<string | null> {
  const info = worktreeOf(path)
  if (!info) return removeUnregistered(path)
  if (info.pending) {
    forgetWorktree(info.path)
    return null
  }
  try {
    // --force: o que sobrou já foi conferido (ou a pessoa aceitou perder); node_modules e .env vão junto.
    await git(info.main, ['worktree', 'remove', '--force', info.path], { timeout: 180_000 })
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr?.trim() ?? ''
    // A pasta já tinha sumido: só falta o git esquecer dela.
    if (!/is not a working tree|not a working tree/i.test(stderr)) return stderr || errorMessage(err)
  }
  await git(info.main, ['worktree', 'prune']).catch(() => {})
  forgetStatus(info.main)
  forgetWorktree(info.path)
  return null
}

// Card de tarefa sem registro (o app fechou no meio de uma remoção, ou o registro se perdeu): sem a
// pasta no disco, não há o que apagar e o card só sai. Com a pasta, e sendo um worktree, apaga pelo
// repositório principal, que o próprio git aponta (--git-common-dir).
async function removeUnregistered(path: string): Promise<string | null> {
  const dir = resolve(expandHome(path))
  if (!existsSync(dir)) return null
  const repo = findRepo(dir)
  if (!repo || !statSync(join(repo.root, '.git')).isFile())
    return tr('A pasta não é um worktree; tire o card do canvas pelo menu.', 'The folder isn’t a worktree; remove the card from the canvas through the menu.')
  try {
    const common = (await git(repo.root, ['rev-parse', '--path-format=absolute', '--git-common-dir'])).trim()
    const main = dirname(common)
    await git(main, ['worktree', 'remove', '--force', repo.root], { timeout: 180_000 })
    await git(main, ['worktree', 'prune']).catch(() => {})
    forgetStatus(main)
    return null
  } catch (err) {
    const stderr = (err as { stderr?: string }).stderr?.trim()
    return stderr || errorMessage(err)
  }
}
