import { writeFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Conferência do login do Antigravity, com o `agy acp` trocado por um falso que escreve o log dele
// no arquivo pedido em --log-file, como o de verdade.

const fake = vi.hoisted(() => ({ log: '', list: null as Error | null, args: [] as string[] }));

vi.mock('./env', () => ({ providerLaunch: (_p: string, args: string[]) => ((fake.args = args), { file: 'agy', args, env: {}, account: 'main' }) }));
vi.mock('./paths', () => ({ providerAccountDir: () => undefined }));
vi.mock('./acpProcess', () => ({
  openAcpProcess: async () => ({
    request: async () => {
      const file = fake.args.find((a) => a.startsWith('--log-file='))!.slice('--log-file='.length);
      writeFileSync(file, fake.log);
      if (fake.list) throw fake.list;
      return { sessions: [] };
    },
    close: () => {},
  }),
}));

const { antigravityStatus } = await import('./antigravity');
const { RpcError } = await import('./rpc');

beforeEach(() => {
  fake.log = '';
  fake.list = null;
});

describe('login do Antigravity', () => {
  it('logado: o e-mail vem da linha de login do log do agy', async () => {
    fake.log = 'I1119 10:19:06 server_oauth.go:221] applyAuthResult: email=ana.souza@gmail.com, authMethod=consumer, quotaProject=\n';
    expect(await antigravityStatus('main')).toEqual({ signedIn: true, email: 'ana.souza@gmail.com' });
  });

  it('log sem a linha (versão nova do agy): logado, sem e-mail', async () => {
    fake.log = 'I1119 10:19:06 outra coisa\n';
    expect(await antigravityStatus('main')).toEqual({ signedIn: true, email: undefined });
  });

  it('sem login: a lista de conversas é recusada', async () => {
    fake.list = new RpcError('Authentication required', -32000);
    expect(await antigravityStatus('main')).toEqual({ signedIn: false });
  });

  it('o agy não respondeu: sem resposta, para manter o que se sabia', async () => {
    fake.list = new Error('sem resposta para session/list');
    expect(await antigravityStatus('main')).toBeNull();
  });
});
