import { describe, expect, it, vi } from 'vitest';

const electronApp = vi.hoisted(() => ({ getVersion: () => '0.1.152', getPath: () => '/tmp', isPackaged: true }));
vi.mock('electron', () => ({ app: electronApp }));
vi.mock('../errorReports', () => ({ reportWarning: vi.fn() }));

const { recordMissingUninstaller, recordUnsupported, trackFailure } = await import('./report');
const { reportWarning } = await import('../errorReports');

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

// Atualização desligada não deixava pista (2026-11-27): no app instalado ela precisa virar aviso,
// com o motivo e as pistas; em desenvolvimento (sempre desligada), só o diário.
describe('recordUnsupported', () => {
  it('no app instalado, vira aviso com o motivo e as pistas', () => {
    vi.mocked(reportWarning).mockClear();
    recordUnsupported('Instale pelo instalador.', { uninstaller: false, standardDir: true });
    expect(reportWarning).toHaveBeenCalledWith('Atualização desligada', {
      current: '0.1.152',
      reason: 'Instale pelo instalador.',
      uninstaller: false,
      standardDir: true,
    });
  });

  it('em desenvolvimento, não avisa', () => {
    vi.mocked(reportWarning).mockClear();
    electronApp.isPackaged = false;
    try {
      recordUnsupported('Em desenvolvimento o app não se atualiza.');
    } finally {
      electronApp.isPackaged = true;
    }
    expect(reportWarning).not.toHaveBeenCalled();
  });
});

// Windows na pasta do instalador sem o desinstalador: atualiza mesmo assim, mas avisa (a suspeita é
// antivírus apagando o arquivo).
describe('recordMissingUninstaller', () => {
  it('no app instalado, vira aviso com as pistas', () => {
    vi.mocked(reportWarning).mockClear();
    recordMissingUninstaller({ uninstaller: false, standardDir: true });
    expect(reportWarning).toHaveBeenCalledWith('Atualização sem o desinstalador', { current: '0.1.152', uninstaller: false, standardDir: true });
  });
});
