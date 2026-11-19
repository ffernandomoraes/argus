import { afterEach, describe, expect, it } from 'vitest';
import { clearClaudeProcesses, setChatCounter } from './claudeProcesses';
import { clearJournal, journalTail } from './journal';
import { clearLoginHistory, fingerprintOf, observeLogin, recentLoginChanges } from './loginHistory';

// Quando o login guardado mudou e se havia `claude` do Argus aberto da conta: separa "o Argus
// renovou" de "outro programa renovou" no aviso de login perdido (ARGUS-K, 2026-11-18).

const stored = (refreshToken: string, expiresAt?: number) => ({ claudeAiOauth: { accessToken: 'acesso', refreshToken, expiresAt } });

afterEach(() => {
  clearLoginHistory();
  clearClaudeProcesses();
  clearJournal();
});

describe('histórico do login', () => {
  it('impressão digital: 8 letras de um resumo, sem o login', () => {
    const fingerprint = fingerprintOf(stored('codigo-secreto'));
    expect(fingerprint).toMatch(/^[0-9a-f]{8}$/);
    expect(fingerprintOf(stored('codigo-secreto'))).toBe(fingerprint);
    expect(fingerprintOf(stored('outro-codigo'))).not.toBe(fingerprint);
    expect(fingerprintOf(null)).toBeNull();
    expect(fingerprintOf({ claudeAiOauth: { accessToken: '', refreshToken: '' } })).toBeNull();
  });

  it('mudança sem nenhum claude do Argus aberto da conta: argus=0', () => {
    observeLogin({ account: 'main', stored: stored('r1', 8 * 3_600_000), state: 'ok' }, 0);
    observeLogin({ account: 'main', stored: stored('r1', 8 * 3_600_000), state: 'ok' }, 60_000);
    observeLogin({ account: 'main', stored: stored('r2', 16 * 3_600_000), state: 'ok' }, 120_000);
    expect(recentLoginChanges('main', 180_000)).toBe('1 min atrás: ok, argus=0, leitura anterior 1 min antes');
    const journal = journalTail(10, 5000);
    expect(journal).toContain('login guardado lido account=main');
    expect(journal).toContain('login guardado mudou account=main');
    expect(journal).toContain('argusClaudes=0');
    expect(journal).not.toContain('r1');
  });

  it('apagado pelo Claude Code com uma conversa da conta aberta', () => {
    setChatCounter((account) => (account === 'x1' ? 1 : 0));
    observeLogin({ account: 'x1', stored: stored('r1'), state: 'ok' }, 0);
    observeLogin({ account: 'x1', stored: { claudeAiOauth: { accessToken: '', refreshToken: '', loginEnded: 'refresh_failed' } }, state: 'ended' }, 10 * 60_000);
    const journal = journalTail(10, 5000);
    expect(journal).toContain('login apagado pelo Claude Code account=x1');
    expect(journal).toContain('to=null state=ended');
    expect(journal).toContain('argusClaudes=1 minutesSincePreviousRead=10 loginEnded=refresh_failed');
  });

  it('leitura que falhou não conta, e a conta do WSL é outra', () => {
    observeLogin({ account: 'main', stored: stored('r1'), state: 'ok' }, 0);
    observeLogin({ account: 'main', stored: null, state: 'unreadable' }, 1000);
    observeLogin({ account: 'main', place: '\\\\wsl.localhost\\Ubuntu\\home\\x', stored: stored('r9'), state: 'ok' }, 2000);
    expect(recentLoginChanges('main', 3000)).toBe('');
  });
});
