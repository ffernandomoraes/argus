import { access, mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { tr } from '../i18n';
import { liveSessions } from '../liveSessions';
import { expandHome } from '../paths';
import { isSessionId, projectDir, projectsDir } from '../transcripts/projectDir';

// "Mover para projeto": a conversa solta (que roda na pasta do usuário) passa a ser de uma pasta. O
// Claude Code acha a conversa pela pasta do projeto (~/.claude/projects/<pasta achatada>), então
// basta levar o .jsonl e a pasta com o mesmo id (os subagentes). As mensagens antigas continuam com
// o cwd de antes, como no "Localizar pasta…" (relocate.ts), e o `--resume` segue normal. As contas
// do Argus enxergam o mesmo ~/.claude/projects, então vale para qualquer conta.

// Quanto esperar o Claude Code da conversa, recém-fechado aqui, sair antes de mover.
const EXIT_WAIT_MS = 4000;
const EXIT_POLL_MS = 200;

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

// Algum Claude Code (deste app, terminal, VS Code) com a conversa aberta: ele continuaria gravando
// no arquivo antigo.
async function openSomewhere(id: string): Promise<boolean> {
  for (let waited = 0; ; waited += EXIT_POLL_MS) {
    if (!(await liveSessions()).has(id)) return false;
    if (waited >= EXIT_WAIT_MS) return true;
    await new Promise((r) => setTimeout(r, EXIT_POLL_MS));
  }
}

// Devolve o erro, ou nulo quando deu certo. `closeHere`: fecha a sessão deste app que esteja com a
// conversa; falso quando ela está trabalhando.
export async function moveSession(from: string, to: string, id: string, closeHere: (id: string) => boolean): Promise<string | null> {
  if (!isSessionId(id) || typeof from !== 'string' || typeof to !== 'string' || !from || !to) return tr('Conversa inválida.', 'Invalid chat.');
  const src = projectDir(from);
  const dst = projectDir(to);
  if (src === dst) return null;
  if (projectsDir(expandHome(from)) !== projectsDir(expandHome(to)))
    return tr(
      'A pasta está em outro sistema (Windows e WSL): cada um guarda as conversas no seu.',
      'The folder is on another system (Windows and WSL): each one keeps its own chats.',
    );
  const status = (await liveSessions()).get(id);
  if (status === 'running' || status === 'needs-you' || !closeHere(id))
    return tr('A conversa está em andamento. Interrompa ou espere terminar antes de mover.', 'This chat is still running. Stop it or let it finish before moving it.');
  if (await openSomewhere(id))
    return tr(
      'A conversa está aberta em outro lugar (um terminal ou o VS Code). Feche lá antes de mover.',
      'This chat is open somewhere else (a terminal or VS Code). Close it there before moving it.',
    );
  const file = `${id}.jsonl`;
  if (!(await exists(join(src, file)))) return tr('O arquivo da conversa não foi encontrado.', 'The chat file was not found.');
  if ((await exists(join(dst, file))) || (await exists(join(dst, id))))
    return tr('O projeto já tem uma conversa com o mesmo id.', 'The project already has a chat with the same id.');
  try {
    await mkdir(dst, { recursive: true });
    await rename(join(src, file), join(dst, file));
    if (await exists(join(src, id))) await rename(join(src, id), join(dst, id));
    return null;
  } catch (err) {
    return tr(`Não deu para mover a conversa: ${(err as Error).message}`, `Could not move the chat: ${(err as Error).message}`);
  }
}
