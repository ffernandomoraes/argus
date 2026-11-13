import { describe, expect, it } from 'vitest';
import type { Account, ClaudeAccount } from './auth';
import { wslUsage, wslUsageKey } from './wslUsage';

// 2026-11-12 (print de um Windows com o claude.exe e as pastas no WSL): a conta "Henrique" aparecia
// em 0% enquanto as conversas dela no WSL gastavam o limite de outro login.

const signedIn = (email: string): Account => ({ loggedIn: true, email });
const account = (id: string, status: Account | null, wsl?: Account | null, distro = 'Ubuntu'): Pick<ClaudeAccount, 'id' | 'status' | 'wsl'> => ({
  id,
  status,
  ...(wsl !== undefined && { wsl: [{ distro, status: wsl }] }),
});

describe('wslUsage', () => {
  it('sem WSL (Mac, ou Windows sem distro com o Claude): nada', () => {
    expect(wslUsage([account('main', signedIn('ana@x.com'))])).toEqual({ logins: [], borrowed: [] });
  });

  it('login de lá igual ao da conta no Windows: o uso é o mesmo, sem linha a mais', () => {
    expect(wslUsage([account('main', signedIn('ana@x.com'), signedIn('Ana@x.com'))])).toEqual({ logins: [], borrowed: [] });
  });

  it('login de lá de uma conta do Claude que o app não tem no Windows: linha própria', () => {
    const { logins, borrowed } = wslUsage([account('main', signedIn('ana@x.com'), signedIn('bia@x.com'))]);
    expect(logins).toEqual([{ key: wslUsageKey('Ubuntu', 'main'), account: 'main', distro: 'Ubuntu', email: 'bia@x.com' }]);
    expect(borrowed).toEqual([]);
  });

  it('login de lá igual ao de outra conta do app: o uso já aparece nela', () => {
    const { logins, borrowed } = wslUsage([account('main', signedIn('ana@x.com'), signedIn('bia@x.com')), account('ab12cd34', signedIn('bia@x.com'), null)]);
    expect(logins).toEqual([{ key: wslUsageKey('Ubuntu', 'ab12cd34'), account: 'ab12cd34', distro: 'Ubuntu' }]);
    expect(borrowed).toEqual([{ account: 'main', distro: 'Ubuntu', from: 'ab12cd34' }]);
  });

  it('o mesmo login de lá em duas contas: uma linha só', () => {
    const { logins } = wslUsage([account('main', signedIn('ana@x.com'), signedIn('cris@x.com')), account('ab12cd34', signedIn('bia@x.com'), signedIn('cris@x.com'))]);
    expect(logins.map((l) => l.account)).toEqual(['main']);
  });

  it('sem login lá, ou login por chave de API (sem e-mail): nada', () => {
    expect(wslUsage([account('main', signedIn('ana@x.com'), { loggedIn: false })]).logins).toEqual([]);
    expect(wslUsage([account('main', signedIn('ana@x.com'), { loggedIn: true })]).logins).toEqual([]);
  });

  it('conta do Windows sem login e a de lá com: linha própria', () => {
    expect(wslUsage([account('main', { loggedIn: false }, signedIn('bia@x.com'))]).logins).toHaveLength(1);
  });

  it('ainda conferindo o login (o da conta ou o de lá): fica sem decidir, sem e-mail', () => {
    expect(wslUsage([account('main', null, signedIn('bia@x.com'))]).logins).toEqual([{ key: 'wsl:ubuntu:main', account: 'main', distro: 'Ubuntu' }]);
    expect(wslUsage([account('main', signedIn('ana@x.com'), null)]).logins).toEqual([{ key: 'wsl:ubuntu:main', account: 'main', distro: 'Ubuntu' }]);
  });
});
