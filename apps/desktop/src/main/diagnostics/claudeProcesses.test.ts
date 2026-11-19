import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { afterEach, describe, expect, it } from 'vitest';
import { argusClaudes, clearClaudeProcesses, lastClaudeFailure, setChatCounter, trackClaude } from './claudeProcesses';
import { clearJournal, journalTail } from './journal';

// Os `claude` que o Argus abre fora das conversas. ARGUS-K, 2026-11-18: o rastro dizia só "saiu com
// código 1", sem dizer qual `claude`, de qual conta nem o que ele escreveu no erro.

type Fake = ChildProcess & { stderr: EventEmitter };

function fakeProc(pid = 42): Fake {
  return Object.assign(new EventEmitter(), { pid, stderr: new EventEmitter() }) as unknown as Fake;
}

afterEach(() => {
  clearClaudeProcesses();
  clearJournal();
});

describe('processos do claude', () => {
  it('falha: guarda qual era, como saiu e a mensagem do erro sem a pilha', () => {
    const p = fakeProc();
    trackClaude(p, 'main', 'usageOnce');
    expect(argusClaudes('main')).toBe(1);
    p.stderr.emit('data', Buffer.from('Error: OAuth token refresh failed: invalid_grant\n    at refresh (cli.js:1:1)\n'));
    p.emit('close', 1, null);
    expect(argusClaudes('main')).toBe(0);
    expect(lastClaudeFailure('main', 60_000)).toMatchObject({
      role: 'usageOnce',
      exit: '1',
      stderr: 'Error: OAuth token refresh failed: invalid_grant',
    });
    const journal = journalTail(5, 2000);
    expect(journal).toContain('[claude] abriu: uso (de uma vez só) account=main pid=42');
    expect(journal).toContain('[claude] uso (de uma vez só) saiu com 1 account=main');
    expect(journal).toContain('stderr="Error: OAuth token refresh failed: invalid_grant"');
  });

  it('fechado por sinal e programa que nem abriu também contam como falha', () => {
    const killed = fakeProc();
    trackClaude(killed, 'a1', 'usage');
    killed.emit('close', null, 'SIGTERM');
    expect(lastClaudeFailure('a1', 60_000)?.exit).toBe('SIGTERM');
    const missing = fakeProc();
    trackClaude(missing, 'a2', 'renew');
    missing.emit('error', new Error('spawn claude ENOENT'));
    missing.emit('close', -2, null);
    expect(lastClaudeFailure('a2', 60_000)?.exit).toBe('erro ao abrir (spawn claude ENOENT)');
  });

  it('a conferência do login que deu certo não entra no diário', () => {
    const p = fakeProc();
    trackClaude(p, 'main', 'authStatus');
    p.emit('close', 0, null);
    expect(journalTail(5, 1000)).toBe('');
    expect(lastClaudeFailure('main', 60_000)).toBeNull();
  });

  it('a falha de outra conta, ou antiga, não é a desta', () => {
    const p = fakeProc();
    trackClaude(p, 'outra', 'usage');
    p.emit('close', 1, null);
    expect(lastClaudeFailure('main', 60_000)).toBeNull();
    expect(lastClaudeFailure('outra', 60_000, Date.now() + 120_000)).toBeNull();
  });

  it('as conversas abertas da conta contam como claude do Argus', () => {
    setChatCounter((account) => (account === 'main' ? 2 : 0));
    trackClaude(fakeProc(), 'main', 'usage');
    expect(argusClaudes('main')).toBe(3);
    expect(argusClaudes('outra')).toBe(0);
  });
});
