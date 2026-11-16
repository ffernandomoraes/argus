import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { WorktreeReserved } from '@argus/shared/worktrees';
import { git } from '../gitBranch/git';
import { currentBranch, findRepo } from '../gitBranch/repo';
import { tr } from '../i18n';
import { expandHome } from '../paths';
import { rememberWorktree, worktreeOf } from './store';

// Worktree em que o próprio Claude levou a conversa (ferramenta EnterWorktree), criado por ele ou já
// existente: passa a ser acompanhado como os do Argus, para o card filho mostrar a branch e os
// arquivos alterados e poder ser removido. `from`: a pasta de onde a conversa saiu, do mesmo
// repositório. Já acompanhado, só devolve.
export async function adoptWorktree(path: string, from: string): Promise<WorktreeReserved> {
  const full = resolve(expandHome(path));
  const known = worktreeOf(full);
  if (known) return { ok: true, path: full, base: known.base };
  // Aviso velho de uma pasta que já foi apagada: nada a acompanhar.
  const exists = await stat(full).then(
    () => true,
    () => false,
  );
  if (!exists) return { ok: false, error: tr('A pasta do worktree não existe mais.', 'The worktree folder no longer exists.') };
  const repo = await findRepo(resolve(expandHome(from)));
  if (!repo) return { ok: false, error: tr('A pasta não é um repositório git.', 'This folder isn’t a git repository.') };
  // Saiu de outro worktree: o principal é o dele.
  const main = worktreeOf(repo.root)?.main ?? repo.root;
  const base = await adoptedBase(full, repo.root);
  rememberWorktree({ path: full, main, base, adopted: true });
  return { ok: true, path: full, base };
}

// De onde o worktree saiu. O Claude Code cria a partir da branch padrão do remoto
// (worktree.baseRef "fresh", o padrão) ou do HEAD local ("head"), e entra em worktrees de qualquer
// branch. Antes valia sempre a branch da pasta de origem: com ela numa feature, a contagem somava o
// que a main tinha a mais e o agente ouvia a base errada para o PR (2026-11-16). Agora, entre a
// branch da pasta e a padrão do remoto, vale a que deixa menos commits só do worktree; no empate,
// a da pasta.
async function adoptedBase(worktree: string, source: string): Promise<string> {
  const from = (await currentBranch(source)) ?? (await currentBranch(worktree));
  const remoteDefault = await git(worktree, ['symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD']).then(
    (out) => out.trim().replace(/^origin\//, '') || null,
    () => null,
  );
  const candidates = [...new Set([from, remoteDefault].filter((b): b is string => !!b))];
  if (candidates.length < 2) return candidates[0] ?? 'HEAD';
  const ahead = (branch: string) =>
    Promise.all(
      [branch, `origin/${branch}`].map((ref) =>
        git(worktree, ['rev-list', '--count', `${ref}..HEAD`]).then(
          (out) => Number(out.trim()),
          () => Number.POSITIVE_INFINITY,
        ),
      ),
    ).then((counts) => Math.min(...counts));
  const counts = await Promise.all(candidates.map(ahead));
  return counts[1] < counts[0] ? candidates[1] : candidates[0];
}
