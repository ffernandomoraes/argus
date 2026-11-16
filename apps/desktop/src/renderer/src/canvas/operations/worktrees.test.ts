import { describe, expect, it } from 'vitest';
import type { CanvasNode, ProjectNode } from '../types';
import { boxOf, GAP } from './geometry';
import { addWorktreeCard } from './worktrees';

// Tarefa nova entra logo embaixo da pasta: a pasta que estava ali desce, em vez de a tarefa pular
// para depois dela.

const folder = (id: string, x: number, y: number, of?: string) =>
  ({
    id,
    type: 'project',
    position: { x, y },
    measured: { width: of ? 340 : 400, height: 130 },
    data: { name: id, path: `~/${id}`, color: '#fff', ...(of && { worktree: { of } }) },
  }) as CanvasNode;
const task = (id: string, of: string) =>
  ({ id, type: 'project', position: { x: 0, y: 0 }, measured: { width: 340, height: 130 }, data: { name: id, path: '~/a', color: '#fff', worktree: { of } } }) as ProjectNode;
const byId = (nodes: CanvasNode[], id: string) => nodes.find((n) => n.id === id)!;
// Topo de um bloco encostado (na GAP) embaixo de outro.
const under = (nodes: CanvasNode[], id: string) => {
  const b = boxOf(byId(nodes, id));
  return b.y + b.height + GAP;
};
const top = (nodes: CanvasNode[], id: string) => boxOf(byId(nodes, id)).y;

describe('addWorktreeCard', () => {
  it('empurra a pasta de baixo e entra logo embaixo da pasta de origem', () => {
    const out = addWorktreeCard([folder('a', 0, 0), folder('b', 0, 160)], 'a', task('t', 'a'));
    expect(top(out, 't')).toBe(under(out, 'a'));
    expect(byId(out, 't').position.x).toBe(60);
    expect(top(out, 'b')).toBe(under(out, 't'));
    expect(byId(out, 'b').position.x).toBe(0);
  });

  it('a segunda tarefa entra depois da primeira, e a pasta de baixo desce de novo', () => {
    const first = addWorktreeCard([folder('a', 0, 0), folder('b', 0, 160)], 'a', task('t1', 'a'));
    const out = addWorktreeCard(first, 'a', task('t2', 'a'));
    expect(top(out, 't1')).toBe(under(out, 'a'));
    expect(top(out, 't2')).toBe(under(out, 't1'));
    expect(top(out, 'b')).toBe(under(out, 't2'));
  });

  it('bloco ao lado da pasta, longe da coluna, fica onde está', () => {
    const out = addWorktreeCard([folder('a', 0, 0), folder('c', 1000, 0)], 'a', task('t', 'a'));
    expect(byId(out, 'c').position).toEqual({ x: 1000, y: 0 });
  });
});
