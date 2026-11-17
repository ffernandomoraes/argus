import type { FileNameList } from '@argus/shared/files';
import { git } from '../gitBranch/git';
import { insideRoot } from '../paths';
import { walkFiles } from './walk';

// Mais que isso a janela não filtra bem a cada tecla (e a lista vai inteira pela ligação no acesso
// remoto).
const MAX_NAMES = 50_000;

// Todos os arquivos do projeto, para a busca pelo nome (como o ⌘P do VS Code). No git: versionados e
// novos, sem o que o .gitignore esconde. Fora dele (ou se o git não responder): a pasta percorrida,
// sem dependências e saídas de build.
export async function listFileNames(root: string): Promise<FileNameList> {
  const base = insideRoot(root, '');
  if (!base) return { files: [], truncated: false };
  try {
    const out = await git(base, ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
      timeout: 15_000,
      maxBuffer: 256 * 1024 * 1024,
    });
    // Arquivo em conflito aparece uma vez por versão.
    const files = [...new Set(out.split('\0').filter(Boolean))];
    // Vazio: a pasta pode estar inteira no .gitignore de um repositório de cima; percorrer mostra o
    // que existe.
    if (files.length) return files.length > MAX_NAMES ? { files: files.slice(0, MAX_NAMES), truncated: true } : { files, truncated: false };
  } catch {
    // Fora de repositório ou sem git: percorre a pasta.
  }
  return walkFiles(base, MAX_NAMES);
}
