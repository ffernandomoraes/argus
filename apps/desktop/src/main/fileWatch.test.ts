import { afterEach, describe, expect, it, vi } from 'vitest';

// O painel que sai animando (Presence) desmonta depois do que entrou e desligava a vigia dele: o
// .md aberto ao lado do drawer não se atualizava quando o Claude gravava uma versão nova
// (2026-11-26). Agora o unwatch só desliga a vigia do próprio arquivo.

const fsMock = vi.hoisted(() => ({ watched: new Map<string, () => void>(), closed: [] as string[] }));
vi.mock('electron', () => ({ BrowserWindow: { getAllWindows: () => [] } }));
vi.mock('node:fs', () => ({
  watch: (full: string, onChange: () => void) => {
    fsMock.watched.set(full, onChange);
    return { on: () => {}, close: () => fsMock.closed.push(full) };
  },
  watchFile: () => {},
  unwatchFile: () => {},
}));

const { unwatchFile, watchFile } = await import('./fileWatch');

function fakePage() {
  const sent: unknown[][] = [];
  const page = { id: 1, isDestroyed: () => false, once: () => {}, send: (...args: unknown[]) => sent.push(args) };
  return { page: page as unknown as Parameters<typeof watchFile>[0], sent };
}

afterEach(() => {
  vi.useRealTimers();
  fsMock.watched.clear();
  fsMock.closed = [];
});

describe('vigia de arquivo da janela', () => {
  it('desligar o arquivo anterior não derruba a vigia do novo', () => {
    vi.useFakeTimers();
    const { page, sent } = fakePage();
    watchFile(page, '/proj', 'a.md');
    watchFile(page, '/docs', 'README.md');
    unwatchFile(page, '/proj', 'a.md');
    fsMock.watched.get('/docs/README.md')?.();
    vi.advanceTimersByTime(200);
    expect(sent).toEqual([['files:changed', '/docs', 'README.md']]);
  });

  it('desliga quando é o arquivo vigiado', () => {
    const { page } = fakePage();
    watchFile(page, '/docs', 'README.md');
    unwatchFile(page, '/docs', 'README.md');
    expect(fsMock.closed).toContain('/docs/README.md');
  });
});
