import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { getVersion: () => '0.1.152', getPath: () => '/tmp' } }));
vi.mock('../errorReports', () => ({ reportWarning: vi.fn() }));

const { trackFailure } = await import('./report');

// Quem ficava dias sem atualizar não deixava pista (2026-11-26): falhas seguidas precisam virar
// aviso, uma vez só, e uma conferência certa zera a contagem.

const fresh = () => ({ failures: 0, errors: [] as string[], reported: false });

describe('trackFailure', () => {
  it('avisa na terceira falha seguida, com as últimas mensagens', () => {
    const t = fresh();
    expect(trackFailure(t, 'a')).toBe(false);
    expect(trackFailure(t, 'b')).toBe(false);
    expect(trackFailure(t, 'c')).toBe(true);
    expect(t.errors).toEqual(['a', 'b', 'c']);
  });

  it('uma conferência certa no meio zera a contagem', () => {
    const t = fresh();
    trackFailure(t, 'a');
    trackFailure(t, 'b');
    trackFailure(t, null);
    expect(trackFailure(t, 'c')).toBe(false);
    expect(t.failures).toBe(1);
  });

  it('avisa uma vez só por sessão', () => {
    const t = fresh();
    for (let i = 0; i < 3; i++) trackFailure(t, 'x');
    expect(trackFailure(t, 'x')).toBe(false);
    trackFailure(t, null);
    for (let i = 0; i < 3; i++) expect(trackFailure(t, 'y')).toBe(false);
  });

  it('guarda só as três últimas mensagens', () => {
    const t = fresh();
    for (const e of ['a', 'b', 'c', 'd']) trackFailure(t, e, 10);
    expect(t.errors).toEqual(['b', 'c', 'd']);
  });
});
