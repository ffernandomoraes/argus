import { rename } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import type { FileOpResult } from '@argus/shared/files';
import { tr } from '../i18n';
import { expandHome, insideRoot } from '../paths';
import { copyEach } from './clipboard';
import { exists, failure, nameTaken, outside } from './fsHelpers';

// Move itens da árvore para uma pasta (arrastar e soltar), sem sobrescrever: com um item de mesmo
// nome lá, para no primeiro e avisa. Mover para a pasta onde já está não faz nada.
export async function moveItems(root: string, rels: string[], dirRel: string): Promise<FileOpResult> {
  const dir = insideRoot(root, dirRel);
  if (!dir) return outside();
  const base = resolve(expandHome(root));
  let last = '';
  try {
    for (const rel of rels) {
      const from = rel ? insideRoot(root, rel) : null;
      if (!from || from === base) return outside();
      if (dir === from || dir.startsWith(from + sep))
        return { ok: false, error: tr('Não dá para mover uma pasta para dentro dela mesma.', 'You can’t move a folder into itself.') };
      if (dirname(from) === dir) continue;
      const to = join(dir, basename(from));
      if (await exists(to)) return nameTaken();
      await rename(from, to);
      last = rel;
    }
    return { ok: true, path: last };
  } catch (err) {
    return failure(err);
  }
}

// Arquivos e pastas soltos na árvore vindos do Finder ou do Explorador: copiados para a pasta (o
// original fica onde estava), com "cópia" no nome se já houver um igual.
export async function importPaths(paths: string[], root: string, dirRel: string): Promise<FileOpResult> {
  const dir = insideRoot(root, dirRel);
  if (!dir) return outside();
  const sources = paths.filter(Boolean).map((p) => resolve(p));
  if (!sources.length) return outside();
  return copyEach(root, dir, sources);
}
