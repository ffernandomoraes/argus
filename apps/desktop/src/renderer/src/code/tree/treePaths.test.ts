import { describe, expect, it } from 'vitest';
import type { FileEntry } from '@argus/shared/files';
import { movedTo, outermost, pathsBetween, visiblePaths } from './treePaths';

// Escolher vários itens e mover na árvore do painel de código.

const entry = (path: string, isDir = false): FileEntry => ({ name: path.split('/').pop()!, path, isDir, ignored: false });

const LISTINGS = {
  '': [entry('src', true), entry('docs', true), entry('README.md')],
  src: [entry('src/a.ts'), entry('src/b.ts')],
  docs: [entry('docs/guia.md')],
};

describe('visiblePaths', () => {
  it('o conteúdo só das pastas abertas, logo abaixo delas', () => {
    expect(visiblePaths(LISTINGS, new Set(['src']))).toEqual(['src', 'src/a.ts', 'src/b.ts', 'docs', 'README.md']);
  });
});

describe('pathsBetween', () => {
  const order = ['src', 'src/a.ts', 'src/b.ts', 'docs', 'README.md'];
  it('nos dois sentidos, com as pontas', () => {
    expect(pathsBetween(order, 'src/a.ts', 'docs')).toEqual(['src/a.ts', 'src/b.ts', 'docs']);
    expect(pathsBetween(order, 'docs', 'src/a.ts')).toEqual(['src/a.ts', 'src/b.ts', 'docs']);
  });
  it('sem o primeiro à vista: só o clicado', () => {
    expect(pathsBetween(order, null, 'docs')).toEqual(['docs']);
    expect(pathsBetween(order, 'sumiu', 'docs')).toEqual(['docs']);
  });
});

describe('outermost e movedTo', () => {
  it('pasta e item dela contam uma vez', () => {
    expect(outermost(['src', 'src/a.ts', 'srcx/b.ts'])).toEqual(['src', 'srcx/b.ts']);
  });
  it('caminho depois de mover', () => {
    expect(movedTo('src/a.ts', 'docs')).toBe('docs/a.ts');
    expect(movedTo('src/a.ts', '')).toBe('a.ts');
  });
});
