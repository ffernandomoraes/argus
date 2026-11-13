import { describe, expect, it } from 'vitest';
import { learnContextWindow } from '../contextWindows';
import { percentOf } from './context';

describe('percentOf', () => {
  it('usa a janela de cada modelo: 1 milhão no Opus/Sonnet 5, 200 mil no Haiku e nos anteriores', () => {
    expect(percentOf({ tokens: 100_000, model: 'claude-opus-5-5' })).toBe(10);
    expect(percentOf({ tokens: 100_000, model: 'claude-haiku-5-5' })).toBe(50);
    expect(percentOf({ tokens: 100_000, model: 'claude-sonnet-4-5' })).toBe(50);
    expect(percentOf({ tokens: 100_000, model: 'claude-sonnet-4-5[1m]' })).toBe(10);
  });

  it('a janela aprendida no chat passa a valer', () => {
    learnContextWindow('claude-teste-9', 400_000);
    expect(percentOf({ tokens: 100_000, model: 'claude-teste-9' })).toBe(25);
  });

  it('sem uso é 0, e nunca passa de 100', () => {
    expect(percentOf(undefined)).toBe(0);
    expect(percentOf({ tokens: 5_000_000, model: 'claude-opus-5-5' })).toBe(100);
  });
});
