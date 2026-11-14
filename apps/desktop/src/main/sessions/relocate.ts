import { mkdir, readdir, rename, rmdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { withTimeout } from '../lib/timeout';
import { expandHome } from '../paths';
import { projectDir, projectsDir } from '../transcripts/projectDir';
import { tr } from '../i18n';

// Pasta renomeada ou movida fora do Argus (no Finder, no Explorer): o card fica apontando para um
// caminho que não existe, e o Claude Code guarda o histórico e a memória numa pasta com o caminho
// achatado (~/.claude/projects/-Users-...-projeto). "Localizar pasta…" leva os dois para o novo.

// Pasta do WSL parada pode demorar a responder: sem resposta, conta como existente (não acusa
// pasta sumida por lentidão).
const ANSWER_MS = 3000;

export async function folderExists(path: string): Promise<boolean> {
  if (typeof path !== 'string' || !path) return true;
  const check = stat(expandHome(path)).then(
    (s) => s.isDirectory(),
    () => false,
  );
  return withTimeout(check, ANSWER_MS, true);
}

const isDir = (path: string) =>
  stat(path).then(
    (s) => s.isDirectory(),
    () => false,
  );
const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

// Leva o que está em `src` para `dst`, que já existe. O que já existe lá fica como está (uma
// conversa feita depois de renomear, por exemplo); o que não deu para levar fica em `src`, que só é
// apagada se ficar vazia. Devolve quantos itens ficaram para trás.
async function mergeInto(src: string, dst: string): Promise<number> {
  let left = 0;
  for (const name of await readdir(src)) {
    const from = join(src, name);
    const to = join(dst, name);
    if (!(await exists(to))) await rename(from, to);
    else if ((await isDir(from)) && (await isDir(to))) left += await mergeInto(from, to);
    else left++;
  }
  if (left === 0) await rmdir(src).catch(() => {});
  return left;
}

// Move o histórico do Claude Code de `from` para `to`. Devolve o erro, ou nulo quando deu certo
// (inclusive quando não havia histórico). As contas do Argus enxergam o mesmo ~/.claude/projects
// (accounts/links.ts), então mover uma vez vale para todas.
export async function relocateHistory(from: string, to: string): Promise<string | null> {
  if (typeof from !== 'string' || typeof to !== 'string' || !from || !to) return tr('Caminho inválido.', 'Invalid path.');
  const src = projectDir(from);
  const dst = projectDir(to);
  if (src === dst || !(await isDir(src))) return null;
  // Pasta do Windows para uma do WSL (ou o contrário): cada lado tem o seu ~/.claude, e mover entre
  // eles seria copiar entre sistemas de arquivos. O histórico fica onde está.
  if (projectsDir(expandHome(from)) !== projectsDir(expandHome(to))) {
    return tr(
      'As conversas antigas ficaram no lugar de antes: a pasta nova está em outro sistema (Windows e WSL).',
      'The old chats stayed where they were: the new folder is on another system (Windows and WSL).',
    );
  }
  try {
    if (!(await exists(dst))) {
      await mkdir(dirname(dst), { recursive: true });
      await rename(src, dst);
      return null;
    }
    const left = await mergeInto(src, dst);
    if (left === 0) return null;
    return tr(
      `${left === 1 ? '1 arquivo' : `${left} arquivos`} do histórico não ${left === 1 ? 'foi levado' : 'foram levados'}: a pasta nova já tinha um com o mesmo nome. Ficaram em ${src}.`,
      `${left === 1 ? '1 history file was' : `${left} history files were`} not moved: the new folder already had one with the same name. They stayed in ${src}.`,
    );
  } catch (err) {
    return tr(`Não deu para levar as conversas antigas: ${(err as Error).message}`, `Could not move the old chats: ${(err as Error).message}`);
  }
}
