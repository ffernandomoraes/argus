import { describe, expect, it } from 'vitest';
import { needsLogin } from './needsLogin';

// Textos do Claude Code 2.1.322 (o do prazo final, medido com um login vencido).

describe('needsLogin', () => {
  it('sem login: ganha o botão de entrar', () => {
    expect(needsLogin('Not logged in · Please run /login')).toBe(true);
    expect(needsLogin('Invalid API key · Please run /login')).toBe(true);
  });

  // O login que se perde sem vencer: o servidor recusa o login ou a renovação e o Claude Code o apaga.
  it('login perdido: ganha o botão de entrar', () => {
    expect(needsLogin('Failed to authenticate: OAuth session expired and could not be refreshed')).toBe(true);
  });

  it('login que chegou ao prazo final: ganha o botão de entrar', () => {
    expect(
      needsLogin(
        'Failed to authenticate: this login reached its time limit and cannot be renewed. Run `claude auth login` to sign in again, or use `claude setup-token` and set CLAUDE_CODE_OAUTH_TOKEN for unattended jobs',
      ),
    ).toBe(true);
  });

  it('o aviso de antes do prazo e outros erros não', () => {
    expect(
      needsLogin(
        'Warning: this sign-in can end at any time from now until 2026-11-14. Renewing it does not move that date. Run claude auth login now, or use claude setup-token for unattended jobs.',
      ),
    ).toBe(false);
    expect(needsLogin('API Error: 529 Overloaded')).toBe(false);
  });
});
