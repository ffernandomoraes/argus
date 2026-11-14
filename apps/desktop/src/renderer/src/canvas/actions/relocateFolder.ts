import type { ConfirmRequest } from '../ConfirmDialog';
import { forSync } from '../flow/syncNodes';
import { nodesFromSaved } from '../flow/savedNodes';
import { relocateFolder } from '../operations/relocate';
import { sameFolder } from '../../platform';
import type { NodesApi } from './types';
import { tr } from '../../i18n';

// "Localizar pasta…" no card de uma pasta que sumiu (renomeada ou movida fora do Argus): a pessoa
// escolhe onde ela está agora. O histórico e a memória do Claude Code vão junto para o caminho
// novo (main/sessions/relocate.ts), e tudo que apontava para o antigo, neste workspace e nos
// outros, passa a apontar para o novo. As sessões paradas na pasta antiga fecham: a próxima
// mensagem já abre no caminho novo. Sem desfazer: o ⌘Z voltaria o card sem trazer o histórico.
export async function relocateFolderCard({ board, nodesRef, setNodes }: NodesApi, confirm: (request: ConfirmRequest) => void, id: string): Promise<void> {
  const node = nodesRef.current.find((n) => n.id === id);
  if (node?.type !== 'project' || node.data.folders || node.data.worktree) return;
  const from = node.data.path;
  const chosen = await window.api.pickFolder();
  if (!chosen || sameFolder(chosen, from)) return;
  const warning = await window.api.sessions.relocate(from, chosen).catch((err: Error) => err.message);
  window.api.chat.restartIn(from);
  setNodes((ns) => relocateFolder(ns, from, chosen));
  for (const other of window.api.boards.state().boards) {
    if (other.id === board || !other.paths.some((p) => sameFolder(p, from))) continue;
    const saved = nodesFromSaved(window.api.canvas.load(other.id)).nodes;
    const next = relocateFolder(saved, from, chosen);
    if (next !== saved) window.api.boards.put(other.id, forSync(next));
  }
  if (warning) confirm({ title: tr('Pasta localizada', 'Folder located'), description: warning });
}
