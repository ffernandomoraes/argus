import type { FileOpResult } from '@argus/shared/files';
import { tr } from '../i18n';
import { errorMessage } from '../lib/errors';
import { insideRoot } from '../paths';
import { trashPath } from '../wsl';
import { gitOutput } from './git';
import { findRepo } from './repo';

// Desfaz as mudanças de um arquivo desde o último commit (o "Descartar alterações" do VS Code). O
// que existia no commit volta como estava; o arquivo novo, que não existia, vai para a Lixeira (dá
// para recuperar) e sai do que estava preparado para o commit.
export async function discardFile(root: string, rel: string): Promise<FileOpResult> {
  const file = rel ? insideRoot(root, rel) : null;
  if (!file) return { ok: false, error: tr('Caminho fora do projeto.', 'Path is outside the project.') };
  const repo = await findRepo(file);
  if (!repo) return { ok: false, error: tr('A pasta não é um repositório git.', 'This folder isn’t a git repository.') };
  try {
    const inHead = (await gitOutput(repo.root, ['ls-tree', '--name-only', 'HEAD', '--', file]).catch(() => '')).trim();
    if (inHead) {
      await gitOutput(repo.root, ['checkout', 'HEAD', '--', file]);
    } else {
      await gitOutput(repo.root, ['rm', '--cached', '--quiet', '--ignore-unmatch', '--', file]);
      await trashPath(file);
    }
    return { ok: true, path: rel };
  } catch (err) {
    return { ok: false, error: tr(`Não consegui desfazer: ${errorMessage(err)}`, `Couldn’t discard: ${errorMessage(err)}`) };
  }
}
