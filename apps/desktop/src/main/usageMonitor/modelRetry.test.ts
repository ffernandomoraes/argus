import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClaudeModel } from '@argus/shared/models';
import { createModelRetry, isReducedModelList } from './modelRetry';

const model = (value: string, displayName: string): ClaudeModel => ({ value, displayName, efforts: [] });
// As duas respostas do `claude` 2.1.323 ao "init": sem o catálogo a tempo e com ele.
const REDUCED = [model('', 'Padrão'), model('opus', 'Opus'), model('fable', 'Fable'), model('sonnet', 'Sonnet'), model('haiku', 'Haiku')];
const FULL = [
  model('', 'Padrão'),
  model('opus', 'Opus 5.5'),
  model('fable', 'Fable 5.2'),
  model('sonnet', 'Sonnet 5.5'),
  model('haiku', 'Haiku 5.5'),
  model('claude-fable-5-1', 'Fable 5.1'),
];

describe('isReducedModelList', () => {
  it('atalho de família sem versão no nome é a lista reduzida', () => {
    expect(isReducedModelList(REDUCED)).toBe(true);
    expect(isReducedModelList(FULL)).toBe(false);
  });

  it('lista vazia (sem login) não é reduzida', () => {
    expect(isReducedModelList([])).toBe(false);
  });
});

describe('createModelRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lista reduzida pergunta de novo em 30 s, 3 min e 15 min, e para', () => {
    const ask = vi.fn();
    const retry = createModelRetry(ask);
    for (const [wait, calls] of [[30_000, 1], [3 * 60_000, 2], [15 * 60_000, 3]]) {
      expect(retry.check(REDUCED)).toBe(true);
      vi.advanceTimersByTime(wait - 1);
      expect(ask).toHaveBeenCalledTimes(calls - 1);
      vi.advanceTimersByTime(1);
      expect(ask).toHaveBeenCalledTimes(calls);
    }
    retry.check(REDUCED);
    vi.advanceTimersByTime(60 * 60_000);
    expect(ask).toHaveBeenCalledTimes(3);
  });

  it('lista inteira cancela o que estava marcado', () => {
    const ask = vi.fn();
    const retry = createModelRetry(ask);
    retry.check(REDUCED);
    expect(retry.check(FULL)).toBe(false);
    vi.advanceTimersByTime(60 * 60_000);
    expect(ask).not.toHaveBeenCalled();
  });
});
