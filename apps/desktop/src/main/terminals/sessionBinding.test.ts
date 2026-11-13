import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../liveSessions', () => ({ sessionIdByPid: () => null }));
vi.mock('../transcripts/projectDir', () => ({ sessionFile: () => null }));

import { watchSession, type SessionLookup } from './sessionBinding';

// O terminal do `claude` sem conversa amarra a que ele cria assim que ela aparece gravada. A
// conferência do disco é assíncrona (no WSL a pasta é de rede e travava o app): ela pode responder
// depois que o terminal fechou.

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// Conferência que só responde quando o teste manda.
function pendingLookup(id: string | null) {
  const answers: ((saved: boolean) => void)[] = [];
  const lookup: SessionLookup = {
    sessionOf: () => id,
    saved: () => new Promise<boolean>((resolve) => answers.push(resolve)),
  };
  return { lookup, answers };
}

describe('watchSession', () => {
  it('amarra a conversa quando ela aparece gravada', async () => {
    const { lookup, answers } = pendingLookup('s1');
    const found = vi.fn();
    watchSession(1, '/proj', found, lookup, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    answers[0](false);
    await vi.advanceTimersByTimeAsync(1000);
    answers[1](true);
    await vi.advanceTimersByTimeAsync(0);
    expect(found).toHaveBeenCalledExactlyOnceWith('s1');
  });

  it('a próxima conferência espera a anterior responder', async () => {
    const { lookup, answers } = pendingLookup('s1');
    watchSession(1, '/proj', vi.fn(), lookup, 1000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(answers).toHaveLength(1);
  });

  it('terminal fechado enquanto a conferência não respondia: não amarra nem volta a conferir', async () => {
    const { lookup, answers } = pendingLookup('s1');
    const found = vi.fn();
    const stop = watchSession(1, '/proj', found, lookup, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    stop();
    answers[0](true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(found).not.toHaveBeenCalled();
    expect(answers).toHaveLength(1);
  });

  it('conferência que falha conta como ainda não gravada', async () => {
    const found = vi.fn();
    let calls = 0;
    const lookup: SessionLookup = {
      sessionOf: () => 's1',
      saved: () => (++calls === 1 ? Promise.reject(new Error('EIO')) : Promise.resolve(true)),
    };
    watchSession(1, '/proj', found, lookup, 1000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(found).toHaveBeenCalledExactlyOnceWith('s1');
  });
});
