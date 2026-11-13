import { describe, expect, it } from 'vitest';
import { followMerged, LOGIN_WARN_MS, loginEndingSoon, loginIdentity, lostLogin, reloginMethod, sameIdentity, sameLogin } from './auth';

const now = Date.UTC(2026, 10, 12, 12);
const HOUR = 60 * 60_000;

describe('loginEndingSoon', () => {
  it('perto do prazo final, ou já passado: avisa', () => {
    expect(loginEndingSoon({ loggedIn: true, loginEndsAt: now + 38 * HOUR }, now)).toBe(true);
    expect(loginEndingSoon({ loggedIn: true, loginEndsAt: now - HOUR }, now)).toBe(true);
  });

  it('longe do prazo: não avisa', () => {
    expect(loginEndingSoon({ loggedIn: true, loginEndsAt: now + LOGIN_WARN_MS + HOUR }, now)).toBe(false);
  });

  it('sem prazo conhecido, sem login ou sem status: não avisa', () => {
    expect(loginEndingSoon({ loggedIn: true }, now)).toBe(false);
    expect(loginEndingSoon({ loggedIn: false, loginEndsAt: now + HOUR }, now)).toBe(false);
    expect(loginEndingSoon(null, now)).toBe(false);
  });
});

describe('lostLogin', () => {
  it('conta extra sem login: perdeu (elas só entram na lista já logadas)', () => {
    expect(lostLogin({ id: 'ab12cd34', status: { loggedIn: false } })).toBe(true);
  });

  it('principal sem login: só se o app já a viu logada e ninguém saiu dela pelo app', () => {
    expect(lostLogin({ id: 'main', status: { loggedIn: false }, loginMethod: 'claudeai' })).toBe(true);
    expect(lostLogin({ id: 'main', status: { loggedIn: false } })).toBe(false);
  });

  it('logada ou sem status (não deu para conferir): não', () => {
    expect(lostLogin({ id: 'ab12cd34', status: { loggedIn: true } })).toBe(false);
    expect(lostLogin({ id: 'ab12cd34', status: null })).toBe(false);
  });
});

describe('reloginMethod', () => {
  it('do jeito da última vez; sem saber, pela assinatura do Claude', () => {
    expect(reloginMethod({ loginMethod: 'console' })).toBe('console');
    expect(reloginMethod({})).toBe('claudeai');
  });
});

describe('sameLogin', () => {
  const a = { loggedIn: true, email: 'a@x.com' };

  it('mesmo e-mail e mesma organização, as duas logadas', () => {
    expect(sameLogin(a, { ...a })).toBe(true);
    expect(sameLogin({ ...a, organization: 'Empresa' }, { ...a, organization: 'Empresa' })).toBe(true);
  });

  it('organização diferente, sem login, sem e-mail ou sem status: não', () => {
    expect(sameLogin(a, { ...a, organization: 'Empresa' })).toBe(false);
    expect(sameLogin(a, { loggedIn: false, email: 'a@x.com' })).toBe(false);
    expect(sameLogin({ loggedIn: true }, { loggedIn: true })).toBe(false);
    expect(sameLogin(a, null)).toBe(false);
  });
});

describe('followMerged', () => {
  it('segue até a conta que ficou; sem troca, devolve como veio', () => {
    const merged = { ab12cd34: 'ef56ab78', ef56ab78: 'main' };
    expect(followMerged(merged, 'ab12cd34')).toBe('main');
    expect(followMerged(merged, 'main')).toBe('main');
    expect(followMerged(undefined, 'ab12cd34')).toBe('ab12cd34');
  });

  it('arquivo com volta não trava', () => {
    expect(['a', 'b']).toContain(followMerged({ a: 'b', b: 'a' }, 'a'));
  });
});

// A conta é reconhecida pelos identificadores fixos do Claude, não pelo e-mail (ver sameIdentity).
describe('sameIdentity', () => {
  const ana = { accountUuid: 'acc-1', organizationId: 'org-1', email: 'ana@x.com', organization: 'Ana' };

  it('mesmo identificador de conta e de organização: a mesma, ainda que o e-mail ou o nome tenham mudado', () => {
    expect(sameIdentity(ana, { ...ana, email: 'ana.nova@x.com', organization: 'Outro nome' })).toBe(true);
  });

  it('identificador de conta diferente com o mesmo e-mail: não é a mesma', () => {
    expect(sameIdentity(ana, { ...ana, accountUuid: 'acc-2' })).toBe(false);
  });

  it('mesma pessoa em outra organização (pessoal e empresa): não é a mesma', () => {
    expect(sameIdentity(ana, { ...ana, organizationId: 'org-2' })).toBe(false);
  });

  it('um dos lados sem o identificador da conta: vale o e-mail e a organização', () => {
    expect(sameIdentity(ana, { email: 'ana@x.com', organization: 'Ana' })).toBe(true);
    expect(sameIdentity(ana, { email: 'ana@x.com', organizationId: 'org-1' })).toBe(true);
    expect(sameIdentity(ana, { email: 'bia@x.com', organization: 'Ana' })).toBe(false);
  });

  it('sem nada que identifique: nunca é a mesma', () => {
    expect(sameIdentity({}, {})).toBe(false);
    expect(sameIdentity(ana, undefined)).toBe(false);
  });
});

describe('loginIdentity', () => {
  it('só de conta logada e com algo que identifique', () => {
    expect(loginIdentity({ loggedIn: true, email: 'ana@x.com', accountUuid: 'acc-1', organizationId: 'org-1', method: 'claude.ai' })).toEqual({
      accountUuid: 'acc-1',
      organizationId: 'org-1',
      email: 'ana@x.com',
    });
    expect(loginIdentity({ loggedIn: false, email: 'ana@x.com' })).toBeUndefined();
    expect(loginIdentity({ loggedIn: true, method: 'api-key' })).toBeUndefined();
    expect(loginIdentity(null)).toBeUndefined();
  });
});
