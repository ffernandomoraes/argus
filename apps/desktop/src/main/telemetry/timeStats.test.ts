import { describe, expect, it } from 'vitest';
import { timeStats } from '../../../../telemetry/src/timeStats';

describe('timeStats', () => {
  it('ignora dias sem uso e calcula média, mediana e máximo', () => {
    expect(timeStats([0, 10, 30, 20, 100])).toEqual({ samples: 4, avg: 40, median: 25, max: 100 });
  });

  it('número ímpar de dias: mediana é o do meio', () => {
    expect(timeStats([5, 1, 9])).toMatchObject({ median: 5, max: 9 });
  });

  it('sem uso: tudo zero', () => {
    expect(timeStats([0, 0])).toEqual({ samples: 0, avg: 0, median: 0, max: 0 });
  });
});
