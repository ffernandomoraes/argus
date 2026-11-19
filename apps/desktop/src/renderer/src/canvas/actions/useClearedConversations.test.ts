import { describe, expect, it } from 'vitest';
import type { CanvasNode } from '../types';
import { clearedNodes } from './useClearedConversations';

const node = (id: string, type: string, sessionId: string) =>
  ({ id, type, position: { x: 0, y: 0 }, data: { name: 'Antiga', path: '/p', sessionId } }) as unknown as CanvasNode;

describe('clearedNodes (/clear)', () => {
  it('o card e o bloco fixado da conversa antiga passam para a nova', () => {
    const nodes = [node('a', 'chat', 's1'), node('b', 'chatPanel', 's1'), node('c', 'chat', 's3')];
    const next = clearedNodes(nodes, 's1', 's2');
    expect(next.map((n) => (n.data as { sessionId: string }).sessionId)).toEqual(['s2', 's2', 's3']);
    expect(next[2]).toBe(nodes[2]);
  });

  it('sem card da conversa, a lista fica a mesma', () => {
    const nodes = [node('c', 'chat', 's3')];
    expect(clearedNodes(nodes, 's1', 's2')).toBe(nodes);
  });
});
