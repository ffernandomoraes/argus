import { baseName, sameFolder, tildify } from '../../platform';
import type { CanvasNode } from '../types';

// "Localizar pasta…" (pasta renomeada ou movida fora do Argus): tudo que apontava para a pasta
// antiga passa a apontar para a nova: o card dela, os terminais e as conversas abertas no canvas.
// O card troca de nome junto só se ainda tinha o nome da pasta (um nome escolhido pela pessoa fica).
// Tarefa isolada e espaço de trabalho não entram: o caminho deles é outro (a cópia, a pasta do
// workspace). Sem nada para trocar, devolve a mesma lista.
export function relocateFolder(nodes: CanvasNode[], from: string, to: string): CanvasNode[] {
  const path = tildify(to);
  const oldName = baseName(from);
  const newName = baseName(to);
  let changed = false;
  const next = nodes.map((n): CanvasNode => {
    if (n.type === 'area' || n.type === 'note' || !sameFolder(n.data.path, from)) return n;
    if (n.type === 'project') {
      if (n.data.folders || n.data.worktree) return n;
      changed = true;
      const name = n.data.name === oldName ? newName : n.data.name;
      return { ...n, data: { ...n.data, path, name } };
    }
    // Terminal de workspace: o caminho é a pasta do workspace, não a que sumiu.
    if (n.type === 'terminal' && n.data.folders) return n;
    changed = true;
    return { ...n, data: { ...n.data, path } } as CanvasNode;
  });
  return changed ? next : nodes;
}
