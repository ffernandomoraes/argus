import { describe, expect, it } from 'vitest';
import type { ChatState } from '@argus/shared/chat';
import { activeChats, StatusChanges, statusSignature, titleOf, type ChatEntry } from './entries';

const state = (patch: Partial<ChatState> = {}): ChatState => ({
  status: 'idle',
  partial: '',
  permissions: [],
  revision: 0,
  turnTokens: 0,
  agents: [],
  backgroundTasks: 0,
  ...patch,
});

const entry = (id: string, patch: Partial<ChatState> = {}): ChatEntry => ({ id, cwd: '/p', state: state(patch) });
const agent = (background: boolean) => ({ id: 'a', agent: 'x', description: '', startedAt: 0, toolUses: 0, steps: [], background });

describe('titleOf', () => {
  it('o título lido da sessão, ou "Conversa nova"', () => {
    const titles = new Map([['s1', 'Arrumar login']]);
    expect(titleOf(titles, 's1')).toBe('Arrumar login');
    expect(titleOf(titles, 's2')).toBe('Conversa nova');
    expect(titleOf(titles)).toBe('Conversa nova');
  });
});

describe('StatusChanges', () => {
  it('avisa só quem mudou de status ou apareceu agora', () => {
    const changes = new StatusChanges();
    expect(changes.next([entry('a'), entry('b')]).map((c) => c.entry.id)).toEqual(['a', 'b']);
    const next = changes.next([entry('a', { status: 'running' }), entry('b')]);
    expect(next).toEqual([{ entry: entry('a', { status: 'running' }), before: 'idle' }]);
  });

  it('conversa que fechou e voltou conta como nova', () => {
    const changes = new StatusChanges();
    changes.next([entry('a', { status: 'running' })]);
    changes.next([]);
    expect(changes.next([entry('a', { status: 'running' })])[0].before).toBeUndefined();
  });
});

describe('statusSignature', () => {
  it('o texto chegando não muda o resumo; status, erro e subagentes mudam', () => {
    const base = statusSignature([entry('a', { status: 'running' })]);
    expect(statusSignature([entry('a', { status: 'running', partial: 'abc', turnTokens: 9 })])).toBe(base);
    expect(statusSignature([entry('a', { status: 'needs-you' })])).not.toBe(base);
    expect(statusSignature([entry('a', { status: 'running', error: 'x' })])).not.toBe(base);
    expect(statusSignature([entry('a', { status: 'running', agents: [agent(false)] })])).not.toBe(base);
  });
});

describe('activeChats', () => {
  it('parada e sem nada em segundo plano não aparece no indicador', () => {
    expect(activeChats([entry('a')])).toEqual([]);
  });

  it('parada com tarefa ou subagente em segundo plano entra concluída, com o que roda', () => {
    const [chat] = activeChats([
      entry('a', {
        backgroundTasks: 1,
        backgroundStarts: { t1: 3 },
        backgroundInfo: { t1: { description: 'pnpm dev', type: 'local_bash' } },
        agents: [{ ...agent(true), description: 'Revisar o login', startedAt: 7 }],
        turnStartedAt: 5,
        activity: { kind: 'writing', since: 1 },
      }),
    ]);
    expect(chat).toMatchObject({ key: 'a', status: 'running', turnDone: true, background: 2, foregroundAgents: 0, activity: undefined, turnStartedAt: undefined });
    expect(chat.backgroundItems).toEqual([
      { id: 't1', kind: 'task', description: 'pnpm dev', startedAt: 3 },
      { id: 'a', kind: 'agent', description: 'Revisar o login', startedAt: 7 },
    ]);
  });

  it('trabalhando com subagente em segundo plano não está concluída', () => {
    const [chat] = activeChats([entry('a', { status: 'running', agents: [agent(true)], turnStartedAt: 5 })]);
    expect(chat).toMatchObject({ turnDone: false, background: 1 });
  });

  it('trabalhando mostra a etapa e os subagentes em primeiro plano', () => {
    const [chat] = activeChats([entry('a', { status: 'needs-you', agents: [agent(false)], turnStartedAt: 5, activity: { kind: 'thinking', since: 1 } })]);
    expect(chat).toMatchObject({ status: 'needs-you', foregroundAgents: 1, turnStartedAt: 5, activity: { kind: 'thinking' } });
  });
});
