import { sameFolder } from '../../platform';
import type { CanvasNode, ChatNode, ProjectNode } from '../types';
import { isPlaced, sizeOf } from './geometry';
import { absolutePosition } from './tree';

// "Mover para projeto": pastas que recebem a conversa solta, pelo menu ou arrastando o card dela.

// Pasta comum ou tarefa isolada. Workspace e "conversas do grupo" abrem numa pasta do Argus, não
// numa do usuário.
export function projectTargets(nodes: CanvasNode[], chat: ChatNode): ProjectNode[] {
  return nodes.filter(
    (n): n is ProjectNode =>
      n.type === 'project' && !n.hidden && !n.data.folders && !n.data.groupWide && !sameFolder(n.data.path, chat.data.path),
  );
}

// Pasta que recebe a conversa solta se o card dela for largado onde está: a que contém o centro do
// card. Pastas sobrepostas: vale a desenhada por cima (a última da lista).
export function projectUnder(nodes: CanvasNode[], node: CanvasNode): ProjectNode | undefined {
  if (node.type !== 'chat' || !isPlaced(node)) return undefined;
  const at = absolutePosition(nodes, node);
  const size = sizeOf(node);
  const center = { x: at.x + size.width / 2, y: at.y + size.height / 2 };
  return projectTargets(nodes, node)
    .reverse()
    .find((p) => {
      if (!isPlaced(p)) return false;
      const { x, y } = absolutePosition(nodes, p);
      const s = sizeOf(p);
      return center.x >= x && center.x <= x + s.width && center.y >= y && center.y <= y + s.height;
    });
}
