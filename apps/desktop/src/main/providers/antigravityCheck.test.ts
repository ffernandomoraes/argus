import { describe, expect, it, vi } from 'vitest';

// O motivo do login do Antigravity que falhou, e a versão mínima do agy.

vi.mock('../errorReports', () => ({ reportWarning: () => {} }));
vi.mock('./bins', () => ({ findCommand: () => null }));

const { olderThan, signInFailure } = await import('./antigravityCheck');
const { RpcError } = await import('./rpc');

describe('versão do agy', () => {
  it('antes da 1.5.0 não tem o `agy acp`', () => {
    expect(olderThan('1.4.12', '1.5.0')).toBe(true);
    expect(olderThan('1.5.0', '1.5.0')).toBe(false);
    expect(olderThan('1.5.12', '1.5.0')).toBe(false);
    expect(olderThan('2.0.0', '1.5.0')).toBe(false);
  });
});

describe('login do Antigravity que falhou', () => {
  it('passou de 10 minutos', () => {
    expect(signInFailure(new RpcError('sem resposta para authenticate'))).toMatchObject({ reason: 'timeout', message: expect.stringMatching(/10 minutos/) });
  });

  it('a Google recusou: mostra o motivo dela', () => {
    const failure = signInFailure(new RpcError('Internal error', -32603, { message: 'account not eligible for Antigravity' }));
    expect(failure).toMatchObject({ reason: 'refused', detail: 'account not eligible for Antigravity' });
    expect(failure.message).toContain('account not eligible for Antigravity');
  });

  it('o agy fechou no meio: mostra a última linha dele', () => {
    expect(signInFailure(new RpcError('panic: keyring unavailable'))).toMatchObject({ reason: 'exited', message: expect.stringContaining('keyring unavailable') });
  });

  it('não respondeu ao abrir', () => {
    expect(signInFailure(new RpcError('sem resposta para initialize')).reason).toBe('no_answer');
  });
});

describe('agy antigo demais', () => {
  it('o login que falha por falta do `acp` diz a versão aceita e como atualizar', async () => {
    const { outdatedMessage } = await import('./antigravityCheck');
    const failure = signInFailure(new RpcError('Error: unexpected argument "acp".'));
    expect(failure.reason).toBe('outdated');
    expect(failure.message).toBe(outdatedMessage());
    expect(failure.message).toMatch(/1\.5\.0 ou mais novo/);
    expect(failure.message).toContain('agy update');
  });
});
