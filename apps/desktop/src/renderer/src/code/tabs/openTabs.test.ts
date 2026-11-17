import { describe, expect, it } from 'vitest';
import { deletedTabs, renamedTabs, withoutTab, withTab } from './openTabs';

// Abas de arquivos abertos no painel de código.

describe('abas', () => {
  it('abrir de novo não duplica', () => {
    expect(withTab(['a.ts'], 'a.ts')).toEqual(['a.ts']);
    expect(withTab(['a.ts'], 'b.ts')).toEqual(['a.ts', 'b.ts']);
  });

  it('fechar abre a da direita, ou a da esquerda se era a última', () => {
    expect(withoutTab(['a', 'b', 'c'], 'b')).toEqual({ tabs: ['a', 'c'], next: 'c' });
    expect(withoutTab(['a', 'b', 'c'], 'c')).toEqual({ tabs: ['a', 'b'], next: 'b' });
    expect(withoutTab(['a'], 'a')).toEqual({ tabs: [], next: null });
  });

  it('pasta renomeada ou excluída leva as abas de dentro', () => {
    expect(renamedTabs(['src/a.ts', 'srcx/b.ts', 'c.ts'], 'src', 'lib')).toEqual(['lib/a.ts', 'srcx/b.ts', 'c.ts']);
    expect(deletedTabs(['src/a.ts', 'srcx/b.ts'], 'src')).toEqual(['srcx/b.ts']);
  });
});
