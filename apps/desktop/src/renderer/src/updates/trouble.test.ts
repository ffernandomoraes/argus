import { describe, expect, it } from 'vitest';
import { TROUBLE_AFTER_MS, updateTrouble } from './trouble';

// O aviso de atualização parada só aparece com um dia ou mais sem funcionar (2026-11-27: Windows
// parado na 0.1.152 por seis dias sem nada na tela).

const now = 10 * TROUBLE_AFTER_MS;

describe('updateTrouble', () => {
  it('erro há um dia ou mais: avisa com a mensagem e deixa tentar de novo', () => {
    const since = now - TROUBLE_AFTER_MS;
    expect(updateTrouble({ status: 'error', message: 'Sem conexão', since }, now)).toEqual({ reason: 'Sem conexão', since, canRetry: true });
  });

  it('desligada há dias: avisa com o motivo, sem tentar de novo', () => {
    const since = now - 3 * TROUBLE_AFTER_MS;
    expect(updateTrouble({ status: 'unsupported', reason: 'Instale pelo instalador.', since }, now)).toEqual({
      reason: 'Instale pelo instalador.',
      since,
      canRetry: false,
    });
  });

  it('menos de um dia, ou sem o "desde quando" (desenvolvimento), não avisa', () => {
    expect(updateTrouble({ status: 'error', message: 'x', since: now - TROUBLE_AFTER_MS + 1 }, now)).toBeNull();
    expect(updateTrouble({ status: 'error', message: 'x' }, now)).toBeNull();
    expect(updateTrouble({ status: 'unsupported', reason: 'Em desenvolvimento.' }, now)).toBeNull();
  });

  it('procurando, baixando ou pronta: não avisa', () => {
    expect(updateTrouble({ status: 'checking' }, now)).toBeNull();
    expect(updateTrouble({ status: 'downloading', version: '0.1.160', progress: 0.5 }, now)).toBeNull();
    expect(updateTrouble({ status: 'ready', version: '0.1.160', notesUrl: '' }, now)).toBeNull();
    expect(updateTrouble(undefined, now)).toBeNull();
  });
});
