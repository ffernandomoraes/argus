import { describe, expect, it } from 'vitest';
import { accountUrlFrom, readBody } from './http';

// O endereço do servidor da conta e o teto das respostas.

describe('accountUrlFrom', () => {
  it('uses ARGUS_ACCOUNT_URL only in development, over https or on this computer', () => {
    expect(accountUrlFrom(undefined, false)).toBe('https://account.argusterm.com');
    expect(accountUrlFrom('https://conta.exemplo.dev/', false)).toBe('https://conta.exemplo.dev');
    expect(accountUrlFrom('http://localhost:3000', false)).toBe('http://localhost:3000');
    expect(accountUrlFrom('http://127.0.0.1:3000/', false)).toBe('http://127.0.0.1:3000');
    expect(accountUrlFrom('http://conta.exemplo.dev', false)).toBe('https://account.argusterm.com');
    expect(accountUrlFrom('https://user:pass@conta.exemplo.dev', false)).toBe('https://account.argusterm.com');
    expect(accountUrlFrom('file:///etc/passwd', false)).toBe('https://account.argusterm.com');
    expect(accountUrlFrom('https://conta.exemplo.dev', true)).toBe('https://account.argusterm.com');
  });
});

describe('readBody', () => {
  it('reads up to the limit and stops after it', async () => {
    expect((await readBody(new Response('abc'), 3)).toString()).toBe('abc');
    await expect(readBody(new Response('abcd'), 3)).rejects.toThrow(/larger/);
    const declared = new Response('ab', { headers: { 'content-length': '999' } });
    await expect(readBody(declared, 3)).rejects.toThrow(/larger/);
  });
});
