import { expect, it, vi } from 'vitest';

// ARGUS-T, 2026-11-19: a janela remota que abriu sem ligação recebe nulo no lugar dos workspaces e
// quebrava a tela no `boards.flatMap`.
it('janela remota sem ligação: abre com o principal vazio, sem quebrar', async () => {
  vi.resetModules();
  const original = window.api.boards.state;
  window.api.boards.state = () => null;
  try {
    const { boardsStore } = await import('./boards');
    expect(boardsStore.get()).toMatchObject({ boards: [], current: 'main' });
  } finally {
    window.api.boards.state = original;
  }
});
