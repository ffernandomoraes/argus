import { afterEach, describe, expect, it } from 'vitest';
import { clearJournal, journalTail } from './journal';
import { clearTimings, operationStats, recordDuration, timed } from './timing';

// Quanto as operações que já travaram o processo principal costumam levar (ARGUS-M, N e G): o
// relatório de travamento diz onde parou, e a mediana diz se aquilo é sempre lento ou foi só daquela vez.

afterEach(() => {
  clearTimings();
  clearJournal();
});

describe('tempo das operações', () => {
  it('guarda mediana e máximo, e a lenta entra no diário com a mediana de antes', () => {
    recordDuration('netstatSpawn', 10);
    recordDuration('netstatSpawn', 30);
    recordDuration('netstatSpawn', 5200);
    expect(operationStats().netstatSpawn).toEqual({ count: 3, medianMs: 30, maxMs: 5200, lastMs: 5200, slow: 1 });
    expect(journalTail(5, 1000)).toContain('[lento] netstatSpawn levou 5200 ms medianMs=30 times=3');
  });

  it('a rápida não entra no diário', () => {
    recordDuration('claudePathCheck', 3);
    expect(journalTail(5, 1000)).toBe('');
  });

  it('mede a função e devolve o que ela devolveu, mesmo quando ela lança', () => {
    expect(timed('ptySpawn', () => 42)).toBe(42);
    expect(() =>
      timed('ptySpawn', () => {
        throw new Error('sem conpty');
      }),
    ).toThrow('sem conpty');
    expect(operationStats().ptySpawn.count).toBe(2);
  });
});
