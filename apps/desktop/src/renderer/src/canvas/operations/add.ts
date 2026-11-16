import type { CanvasNode } from '../types';
import { freeSpot, freeY } from './freeSpace';
import { INSTANCE_WIDTH, WORKTREE_WIDTH } from '../factory';
import { type Box, boxOf, GAP, isPlaced, overlaps } from './geometry';
import { growGroupsToFit } from './groupSize';
import { moveToGroup } from './groups';
import { pushAway } from './push';

// Bloco cujo id já está na lista não entra de novo: dois blocos com o mesmo id se confundem
// (o React Flow só desenha um, e as operações mexeriam no outro).
const present = (nodes: CanvasNode[], node: CanvasNode) => nodes.some((n) => n.id === node.id);

// Bloco novo entra na lista: num grupo, no lugar livre dele (o grupo cresce e empurra os
// vizinhos); solto, na posição pedida ou, se ela encostar em outro bloco, descendo até ficar livre.
// Grupo entra no início do array para ficar atrás dos blocos soltos.
export function addNode(nodes: CanvasNode[], node: CanvasNode, groupId?: string): CanvasNode[] {
  if (present(nodes, node)) return nodes;
  if (groupId) return moveToGroup([...nodes, node], node.id, groupId);
  const placed = { ...node, position: freeSpot(nodes, node) } as CanvasNode;
  return placed.type === 'area' ? [placed, ...nodes] : [...nodes, placed];
}

// Tarefas isoladas ficam logo embaixo da pasta como numa árvore: recuadas até a borda direita
// alinhar com a da pasta (o card delas é mais estreito), e a linha desce pela esquerda da pasta e
// entra em cada uma pelo lado (ver worktrees/WorktreeEdge). Perto: só o espaço mínimo entre blocos.
const WORKTREE_INDENT = INSTANCE_WIDTH - WORKTREE_WIDTH;
const BELOW_GAP = GAP;

// A pasta e as tarefas penduradas nela (e as das tarefas), que a nova pula para entrar no fim da fila.
function treeOf(nodes: CanvasNode[], rootId: string): Set<string> {
  const ids = new Set([rootId]);
  for (let grew = true; grew; ) {
    grew = false;
    for (const n of nodes) {
      if (n.type === 'project' && n.data.worktree && ids.has(n.data.worktree.of) && !ids.has(n.id)) {
        ids.add(n.id);
        grew = true;
      }
    }
  }
  return ids;
}

// Tarefa isolada nasce embaixo da pasta (ou da última irmã), recuada para a direita, no mesmo grupo
// da pasta. Bloco que estava embaixo (outra pasta) não é pulado: desce para abrir o lugar, e quem
// estiver embaixo dele desce junto.
export function placeBelow(nodes: CanvasNode[], anchorId: string, node: CanvasNode): CanvasNode[] {
  if (present(nodes, node)) return nodes;
  const anchor = nodes.find((n) => n.id === anchorId);
  if (!anchor || !isPlaced(anchor)) return addNode(nodes, node);
  const a = boxOf(anchor);
  const offset = boxOf({ ...node, position: { x: 0, y: 0 } });
  const box = { ...offset, x: a.x + WORKTREE_INDENT, y: a.y + a.height + BELOW_GAP };
  const tree = treeOf(nodes, anchorId);
  const siblings = nodes.filter((n) => n.parentId === anchor.parentId && !n.hidden && isPlaced(n));
  // Só a fila da pasta e o que está ao lado dela seguram a tarefa; o que está embaixo é empurrado.
  const below = (n: CanvasNode) => !tree.has(n.id) && boxOf(n).y >= a.y + a.height;
  const position = { x: box.x - offset.x, y: freeY(box, siblings.filter((n) => !below(n)).map(boxOf)) - offset.y };
  const group = nodes.find((n) => n.id === anchor.parentId);
  const inGroup = group?.type === 'area';
  const collapsed = inGroup && !!group.data.collapsed;
  const placed = (inGroup ? { ...node, parentId: group.id, extent: 'parent', hidden: collapsed, position } : { ...node, position }) as CanvasNode;
  const opened = pushDown([...nodes, placed], boxOf(placed), siblings.filter(below));
  if (!inGroup) return opened;
  const grown = growGroupsToFit(opened, [placed.id]);
  return collapsed ? grown : pushAway(grown, [group.id]);
}

// Desce os blocos que encostam na caixa nova até a GAP abaixo dela; o empurrar em cadeia leva
// quem estava embaixo deles.
function pushDown(nodes: CanvasNode[], box: Box, candidates: CanvasNode[]): CanvasNode[] {
  const shift = new Map<string, number>();
  for (const n of candidates) {
    const b = boxOf(n);
    if (overlaps(box, b)) shift.set(n.id, box.y + box.height + GAP - b.y);
  }
  if (!shift.size) return nodes;
  const moved = nodes.map((n) => {
    const dy = shift.get(n.id);
    return dy ? ({ ...n, position: { x: n.position.x, y: n.position.y + dy } } as CanvasNode) : n;
  });
  return pushAway(moved, [...shift.keys()]);
}

// Bloco que nasce de outro (a conversa posta no canvas a partir da pasta): à direita dele,
// alinhado pelo topo e no mesmo grupo. Se encostar num vizinho, desce até ficar livre; dentro
// de um grupo, o grupo cresce para caber e empurra os blocos de fora.
export function placeBeside(nodes: CanvasNode[], anchorId: string, node: CanvasNode): CanvasNode[] {
  if (present(nodes, node)) return nodes;
  const anchor = nodes.find((n) => n.id === anchorId);
  if (!anchor || !isPlaced(anchor)) return addNode(nodes, node);
  const a = boxOf(anchor);
  const offset = boxOf({ ...node, position: { x: 0, y: 0 } });
  const box = { ...offset, x: a.x + a.width + GAP, y: a.y };
  const occupied = nodes.filter((n) => n.parentId === anchor.parentId && isPlaced(n)).map(boxOf);
  const position = { x: box.x - offset.x, y: freeY(box, occupied) - offset.y };
  const group = nodes.find((n) => n.id === anchor.parentId);
  if (group?.type !== 'area') return [...nodes, { ...node, position } as CanvasNode];
  const collapsed = !!group.data.collapsed;
  const inside = { ...node, parentId: group.id, extent: 'parent', hidden: collapsed, position } as CanvasNode;
  const grown = growGroupsToFit([...nodes, inside], [inside.id]);
  return collapsed ? grown : pushAway(grown, [group.id]);
}
