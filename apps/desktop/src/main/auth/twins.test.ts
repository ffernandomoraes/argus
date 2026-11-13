import { describe, expect, it } from 'vitest';
import type { Account } from '@argus/shared/auth';
import { findTwins } from './twins';

// Duas contas do app com o mesmo login do Claude viram uma (ver twins.ts).

const login = (email: string, organization?: string): Account => ({ loggedIn: true, method: 'claude.ai', email, organization });
const out: Account = { loggedIn: false };

describe('findTwins', () => {
  it('a principal e uma extra com o mesmo login: a principal fica', () => {
    const accounts = [
      { id: 'main', status: login('a@x.com') },
      { id: 'ab12cd34', status: login('a@x.com') },
    ];
    expect(findTwins(accounts)).toEqual([{ keep: 'main', remove: 'ab12cd34' }]);
    // Mesmo quando foi a principal que acabou de entrar.
    expect(findTwins(accounts, 'main')).toEqual([{ keep: 'main', remove: 'ab12cd34' }]);
  });

  it('duas extras: sai a que acabou de entrar; sem saber qual, fica a mais antiga', () => {
    const accounts = [
      { id: 'main', status: login('outra@x.com') },
      { id: 'ab12cd34', status: login('a@x.com') },
      { id: 'ef56ab78', status: login('a@x.com') },
    ];
    expect(findTwins(accounts, 'ab12cd34')).toEqual([{ keep: 'ef56ab78', remove: 'ab12cd34' }]);
    expect(findTwins(accounts, 'ef56ab78')).toEqual([{ keep: 'ab12cd34', remove: 'ef56ab78' }]);
    expect(findTwins(accounts)).toEqual([{ keep: 'ab12cd34', remove: 'ef56ab78' }]);
  });

  it('três com o mesmo login: fica uma só', () => {
    const accounts = [
      { id: 'main', status: login('a@x.com') },
      { id: 'ab12cd34', status: login('a@x.com') },
      { id: 'ef56ab78', status: login('a@x.com') },
    ];
    expect(findTwins(accounts)).toEqual([
      { keep: 'main', remove: 'ab12cd34' },
      { keep: 'main', remove: 'ef56ab78' },
    ]);
  });

  it('vale o identificador fixo da conta, não o e-mail', () => {
    const withId = (accountUuid: string, email: string): Account => ({ ...login(email), accountUuid, organizationId: 'org-1' });
    // O e-mail mudou entre um login e outro: é a mesma conta.
    expect(
      findTwins([
        { id: 'main', status: withId('acc-1', 'a@x.com') },
        { id: 'ab12cd34', status: withId('acc-1', 'novo@x.com') },
      ]),
    ).toEqual([{ keep: 'main', remove: 'ab12cd34' }]);
    // Mesmo e-mail com identificador diferente: contas diferentes.
    expect(
      findTwins([
        { id: 'main', status: withId('acc-1', 'a@x.com') },
        { id: 'ab12cd34', status: withId('acc-2', 'a@x.com') },
      ]),
    ).toEqual([]);
  });

  it('mesmo e-mail em organizações diferentes (pessoal e empresa): são contas diferentes', () => {
    const accounts = [
      { id: 'main', status: login('a@x.com') },
      { id: 'ab12cd34', status: login('a@x.com', 'Empresa') },
    ];
    expect(findTwins(accounts)).toEqual([]);
  });

  it('sem login, sem status ou sem e-mail (chave de API): nunca conta como repetida', () => {
    expect(
      findTwins([
        { id: 'main', status: out },
        { id: 'ab12cd34', status: out },
      ]),
    ).toEqual([]);
    expect(
      findTwins([
        { id: 'main', status: null },
        { id: 'ab12cd34', status: undefined },
      ]),
    ).toEqual([]);
    expect(
      findTwins([
        { id: 'main', status: { loggedIn: true, method: 'api-key' } },
        { id: 'ab12cd34', status: { loggedIn: true, method: 'api-key' } },
      ]),
    ).toEqual([]);
    // Uma logada e a outra sem login: só dá para saber quando a segunda entrar.
    expect(
      findTwins([
        { id: 'main', status: out },
        { id: 'ab12cd34', status: login('a@x.com') },
      ]),
    ).toEqual([]);
  });
});
