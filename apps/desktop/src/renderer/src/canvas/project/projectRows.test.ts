import { describe, expect, it } from 'vitest';
import type { ConversationSummary } from '../types';
import { visibleConversations } from './projectRows';

const conversation = (id: string, status: ConversationSummary['status']): ConversationSummary => ({
  id,
  title: id,
  kind: 'conversa',
  status,
  updatedAt: '2026-11-17T00:00:00.000Z',
  repliedAt: '2026-11-17T00:00:00.000Z',
  contextPercent: 0,
});

describe('visibleConversations', () => {
  const list = [conversation('server', 'idle'), conversation('working', 'running'), conversation('old', 'idle')];

  it('collapsed: keeps a finished conversation that left something running in the background', () => {
    const ids = visibleConversations(list, true, new Set(['server'])).map((c) => c.id);
    expect(ids).toEqual(['server', 'working']);
  });

  it('collapsed: hides finished conversations with nothing in the background', () => {
    const ids = visibleConversations(list, true, new Set()).map((c) => c.id);
    expect(ids).toEqual(['working']);
  });

  it('expanded: shows every conversation, whatever is running', () => {
    expect(visibleConversations(list, false, new Set()).map((c) => c.id)).toEqual(['server', 'working', 'old']);
  });
});
