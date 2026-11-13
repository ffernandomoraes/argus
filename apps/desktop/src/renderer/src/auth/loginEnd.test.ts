import { describe, expect, it } from 'vitest';
import { loginEndLine, loginEndWarning } from './loginEnd';

const now = Date.UTC(2026, 10, 12, 12);
const HOUR = 60 * 60_000;

describe('prazo final do login', () => {
  it('longe do prazo: o cartão mostra a data, sem destaque, e o painel não avisa', () => {
    const status = { loggedIn: true, loginEndsAt: now + 5 * 24 * HOUR };
    expect(loginEndLine(status, now)).toMatchObject({ soon: false });
    expect(loginEndWarning(status, now)).toBeNull();
  });

  it('perto do prazo: cartão em destaque e aviso no painel, com quanto falta', () => {
    const status = { loggedIn: true, loginEndsAt: now + 38 * HOUR };
    expect(loginEndLine(status, now)).toMatchObject({ soon: true });
    expect(loginEndWarning(status, now)).toContain('1d 14h');
    expect(loginEndWarning(status, now, 'WSL (Ubuntu)')).toContain('WSL (Ubuntu)');
  });

  it('prazo passado com a conta ainda dada como logada: pede para entrar de novo', () => {
    const status = { loggedIn: true, loginEndsAt: now - HOUR };
    expect(loginEndLine(status, now)).toMatchObject({ soon: true });
    expect(loginEndWarning(status, now)).not.toBeNull();
  });

  it('sem prazo conhecido ou sem login: nada', () => {
    expect(loginEndLine({ loggedIn: true }, now)).toBeNull();
    expect(loginEndLine({ loggedIn: false, loginEndsAt: now + HOUR }, now)).toBeNull();
    expect(loginEndWarning(null, now)).toBeNull();
  });
});
