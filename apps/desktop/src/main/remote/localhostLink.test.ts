import { describe, expect, it } from 'vitest';
import { loopbackPort, onLocalPort } from './localhostLink';

describe('loopbackPort', () => {
  it('reconhece os endereços deste computador', () => {
    expect(loopbackPort('http://localhost:3000/login?x=1')).toBe(3000);
    expect(loopbackPort('http://127.0.0.1:5173')).toBe(5173);
    expect(loopbackPort('http://[::1]:8080/')).toBe(8080);
    expect(loopbackPort('http://0.0.0.0:4000')).toBe(4000);
    expect(loopbackPort('http://app.localhost:3000')).toBe(3000);
    expect(loopbackPort('http://localhost')).toBe(80);
    expect(loopbackPort('https://localhost')).toBe(443);
  });

  it('ignora os outros links', () => {
    expect(loopbackPort('https://argusterm.com')).toBeNull();
    expect(loopbackPort('http://192.168.0.10:3000')).toBeNull();
    expect(loopbackPort('mailto:a@b.c')).toBeNull();
    expect(loopbackPort('não é link')).toBeNull();
  });
});

describe('onLocalPort', () => {
  it('troca só a porta e mantém caminho e busca', () => {
    expect(onLocalPort('http://localhost:3000/a/b?x=1#y', 51234)).toBe('http://localhost:51234/a/b?x=1#y');
    expect(onLocalPort('http://0.0.0.0:3000/', 3000)).toBe('http://localhost:3000/');
  });
});
