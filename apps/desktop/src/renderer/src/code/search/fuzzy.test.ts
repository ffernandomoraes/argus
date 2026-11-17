import { describe, expect, it } from 'vitest';
import { fuzzyFilter, fuzzyMatch } from './fuzzy';

// Busca pelo nome do arquivo no painel de código (⌘P).

const PATHS = [
  'src/renderer/src/code/tree/useFileTree.ts',
  'src/renderer/src/code/tree/FileTree.tsx',
  'src/main/files/tree.ts',
  'docs/fileTreeNotes.md',
  'README.md',
];

describe('fuzzyMatch', () => {
  it('letras na ordem, sem precisar estar juntas, sem diferença de maiúscula', () => {
    expect(fuzzyMatch('usefile', PATHS[0])).not.toBeNull();
    expect(fuzzyMatch('UFT', PATHS[0])).not.toBeNull();
    expect(fuzzyMatch('eert', 'README.md')).toBeNull();
  });

  it('marca as letras achadas', () => {
    const hit = fuzzyMatch('read', 'README.md')!;
    expect(hit.positions).toEqual([0, 1, 2, 3]);
  });

  it('com "/" busca nas pastas também', () => {
    expect(fuzzyMatch('main/tree', 'src/main/files/tree.ts')).not.toBeNull();
  });
});

describe('fuzzyFilter', () => {
  it('nome do arquivo e começo de palavra vêm primeiro', () => {
    expect(fuzzyFilter('filetree', PATHS, 10).map((h) => h.path).slice(0, 2)).toEqual([
      'src/renderer/src/code/tree/FileTree.tsx',
      'docs/fileTreeNotes.md',
    ]);
  });

  it('respeita o limite', () => {
    expect(fuzzyFilter('e', PATHS, 2)).toHaveLength(2);
  });
});
