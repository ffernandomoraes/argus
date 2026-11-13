import { describe, expect, it } from 'vitest';
import { dropLoginOverrides, overridesLogin } from './loginOverrides';

// Uma credencial no ambiente em que o app abriu não pode tomar o lugar do login de uma conta extra.

describe('overridesLogin', () => {
  it('as três variáveis que vencem o login, em qualquer caixa, só nas contas extras', () => {
    for (const name of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'anthropic_api_key']) {
      expect(overridesLogin(name, 'ab12cd34')).toBe(true);
      expect(overridesLogin(name, 'main')).toBe(false);
    }
    expect(overridesLogin('ANTHROPIC_BASE_URL', 'ab12cd34')).toBe(false);
    expect(overridesLogin('CLAUDE_CONFIG_DIR', 'ab12cd34')).toBe(false);
  });
});

describe('dropLoginOverrides', () => {
  it('tira da conta extra e deixa a principal como o terminal', () => {
    expect(dropLoginOverrides({ ANTHROPIC_API_KEY: 'k', TERM: 'x' }, 'ab12cd34')).toEqual({ TERM: 'x' });
    expect(dropLoginOverrides({ ANTHROPIC_API_KEY: 'k', TERM: 'x' }, 'main')).toEqual({ ANTHROPIC_API_KEY: 'k', TERM: 'x' });
  });
});
