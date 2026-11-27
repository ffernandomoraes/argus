import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

const userData = mkdtempSync(join(tmpdir(), 'argus-trouble-'));
const electronApp = vi.hoisted(() => ({ getVersion: () => '0.1.152', getPath: (): string => '', isPackaged: true }));
electronApp.getPath = () => userData;
vi.mock('electron', () => ({ app: electronApp }));

const { nextTrouble, recordTrouble, withSince } = await import('./trouble');

// Quem ficava dias parado numa versão não via nada na tela (2026-11-27): a contagem de desde quando a
// atualização não funciona precisa sobreviver às aberturas e recomeçar quando ela volta a funcionar.

describe('nextTrouble', () => {
  it('a primeira falha começa a contagem', () => {
    expect(nextTrouble(null, false, '0.1.152', 1000)).toEqual({ since: 1000, version: '0.1.152' });
  });

  it('falhas seguidas na mesma versão mantêm o começo', () => {
    const saved = { since: 1000, version: '0.1.152' };
    expect(nextTrouble(saved, false, '0.1.152', 5000)).toBe(saved);
  });

  it('uma conferência certa zera', () => {
    expect(nextTrouble({ since: 1000, version: '0.1.152' }, true, '0.1.152', 5000)).toBeNull();
  });

  it('em outra versão (instalada à mão), recomeça', () => {
    expect(nextTrouble({ since: 1000, version: '0.1.151' }, false, '0.1.152', 5000)).toEqual({ since: 5000, version: '0.1.152' });
  });
});

describe('recordTrouble e withSince', () => {
  const error = { status: 'error', message: 'GitHub não respondeu' } as const;

  it('guarda desde quando falha e devolve no estado de erro', () => {
    recordTrouble(false, 1000);
    recordTrouble(false, 9000);
    expect(withSince(error)).toEqual({ ...error, since: 1000 });
    expect(existsSync(join(userData, 'update-trouble.json'))).toBe(true);
  });

  it('não mexe nos outros estados', () => {
    expect(withSince({ status: 'latest' })).toEqual({ status: 'latest' });
  });

  it('a conferência certa apaga o registro', () => {
    recordTrouble(true);
    expect(withSince(error)).toEqual(error);
    expect(existsSync(join(userData, 'update-trouble.json'))).toBe(false);
  });

  it('em desenvolvimento, nada é guardado nem mostrado', () => {
    electronApp.isPackaged = false;
    try {
      recordTrouble(false, 1000);
      expect(withSince(error)).toEqual(error);
      expect(existsSync(join(userData, 'update-trouble.json'))).toBe(false);
    } finally {
      electronApp.isPackaged = true;
    }
  });
});
