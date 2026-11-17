import { describe, expect, it } from 'vitest';
import { gutterChanges } from './gutterChanges';

// Marcas do git na margem do editor de código.

describe('gutterChanges', () => {
  it('linhas novas, alteradas e apagadas', () => {
    const hunks = [{ oldStart: 1, newStart: 1, lines: [' a', '-b', '+B', ' c', '+d', ' e', '-f', ' g'] }];
    expect(gutterChanges(hunks)).toEqual([
      { line: 2, kind: 'modified' },
      { line: 4, kind: 'added' },
      { line: 5, kind: 'deleted' },
    ]);
  });

  it('troca de uma linha por duas: a segunda é nova', () => {
    expect(gutterChanges([{ oldStart: 3, newStart: 3, lines: ['-x', '+y', '+z'] }])).toEqual([
      { line: 3, kind: 'modified' },
      { line: 4, kind: 'added' },
    ]);
  });

  it('apagado no começo do arquivo marca a linha 0', () => {
    expect(gutterChanges([{ oldStart: 1, newStart: 1, lines: ['-x', ' a'] }])).toEqual([{ line: 0, kind: 'deleted' }]);
  });

  it('arquivo novo: tudo verde', () => {
    expect(gutterChanges([{ oldStart: 0, newStart: 1, lines: ['+a', '+b'] }]).map((c) => c.kind)).toEqual(['added', 'added']);
  });
});
