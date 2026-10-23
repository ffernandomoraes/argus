import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { WorktreeReserved } from '../../shared/worktrees'
import { currentBranch, findRepo } from '../gitBranch/repo'
import { tr } from '../i18n'
import { expandHome } from '../paths'
import { rememberWorktree, worktreeOf } from './store'

// Worktree em que o próprio Claude levou a conversa (ferramenta EnterWorktree), criado por ele ou já
// existente: passa a ser acompanhado como os do Argus, para o card filho mostrar a branch e os
// arquivos alterados e poder ser removido. `from`: a pasta de onde a conversa saiu, do mesmo
// repositório. Já acompanhado, só devolve.
export function adoptWorktree(path: string, from: string): WorktreeReserved {
  const full = resolve(expandHome(path))
  const known = worktreeOf(full)
  if (known) return { ok: true, path: full, base: known.base }
  // Aviso velho de uma pasta que já foi apagada: nada a acompanhar.
  if (!existsSync(full)) return { ok: false, error: tr('A pasta do worktree não existe mais.', 'The worktree folder no longer exists.') }
  const repo = findRepo(resolve(expandHome(from)))
  if (!repo) return { ok: false, error: tr('A pasta não é um repositório git.', 'This folder isn’t a git repository.') }
  // Saiu de outro worktree: o principal é o dele.
  const main = worktreeOf(repo.root)?.main ?? repo.root
  // O Claude cria a partir da branch padrão do remoto, e entra em worktrees de qualquer branch: a
  // base é a da pasta de onde a conversa saiu, para quem compara.
  const base = currentBranch(repo.root) ?? currentBranch(full) ?? 'HEAD'
  rememberWorktree({ path: full, main, base, adopted: true })
  return { ok: true, path: full, base }
}
