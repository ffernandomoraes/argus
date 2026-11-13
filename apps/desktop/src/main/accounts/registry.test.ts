import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registryFile } from './paths';

// Como cada conta entrou da última vez (accounts.json): com o login perdido, o "Entrar" abre o
// navegador direto nesse jeito (ver reloginMethod em shared/auth.ts).

async function fresh(saved?: unknown) {
  vi.resetModules();
  const file = registryFile();
  mkdirSync(dirname(file), { recursive: true });
  if (saved === undefined) writeFileSync(file, '{}');
  else writeFileSync(file, JSON.stringify(saved));
  return import('./registry');
}

const saved = () => JSON.parse(readFileSync(registryFile(), 'utf8')) as { methods?: Record<string, string> };

describe('accounts.json: jeito de entrar de cada conta', () => {
  beforeEach(() => {
    if (existsSync(registryFile())) writeFileSync(registryFile(), '{}');
  });

  it('guarda, troca e esquece (sair pelo app)', async () => {
    const r = await fresh();
    expect(r.loginMethod('main')).toBeUndefined();
    r.rememberLoginMethod('main', 'claudeai');
    expect(r.loginMethod('main')).toBe('claudeai');
    expect(saved().methods).toEqual({ main: 'claudeai' });
    r.rememberLoginMethod('main', 'console');
    expect(r.loginMethod('main')).toBe('console');
    r.forgetLoginMethod('main');
    expect(r.loginMethod('main')).toBeUndefined();
    expect(saved().methods).toEqual({});
  });

  it('conta removida leva o jeito junto', async () => {
    const r = await fresh({ accounts: ['ab12cd34'], names: {}, defaultId: 'main', methods: { ab12cd34: 'console' } });
    expect(r.loginMethod('ab12cd34')).toBe('console');
    r.forgetAccount('ab12cd34');
    expect(r.loginMethod('ab12cd34')).toBeUndefined();
  });

  it('arquivo de uma versão anterior (sem methods) ou com valor estranho: ignora', async () => {
    const r = await fresh({ accounts: [], names: {}, defaultId: 'main', methods: { main: 'senha', ab12cd34: 42 } });
    expect(r.loginMethod('main')).toBeUndefined();
    expect(r.loginMethod('ab12cd34')).toBeUndefined();
    const old = await fresh({ accounts: [], names: {}, defaultId: 'main' });
    expect(old.loginMethod('main')).toBeUndefined();
  });
});

// Duas contas com o mesmo login do Claude viram uma (ver mergeAccount): a que saiu deixa um
// apontamento para a que ficou, e a pasta dela espera a próxima abertura para ser apagada.
describe('accounts.json: contas juntadas', () => {
  beforeEach(() => {
    if (existsSync(registryFile())) writeFileSync(registryFile(), '{}');
  });

  const two = { accounts: ['ab12cd34', 'ef56ab78'], names: { ab12cd34: 'Trabalho' }, defaultId: 'ab12cd34', methods: { ab12cd34: 'claudeai' } };

  it('a que saiu passa a valer como a que ficou, inclusive como padrão', async () => {
    const r = await fresh(two);
    r.mergeAccount('ab12cd34', 'main');
    expect(r.accountIds()).toEqual(['main', 'ef56ab78']);
    expect(r.resolveAccount('ab12cd34')).toBe('main');
    expect(r.defaultAccount()).toBe('main');
    expect(r.customName('ab12cd34')).toBeUndefined();
    expect(r.loginMethod('ab12cd34')).toBeUndefined();
    expect(r.mergedAccounts()).toEqual({ ab12cd34: 'main' });
    expect(r.trashedAccounts()).toEqual(['ab12cd34']);
    r.clearTrashedAccounts();
    expect(r.trashedAccounts()).toEqual([]);
    // Depois de reabrir, o grupo que guardava a conta antiga segue na que ficou.
    const again = await fresh(JSON.parse(readFileSync(registryFile(), 'utf8')));
    expect(again.resolveAccount('ab12cd34')).toBe('main');
  });

  it('a que ficou é juntada depois a outra: quem apontava para ela acompanha', async () => {
    const r = await fresh(two);
    r.mergeAccount('ab12cd34', 'ef56ab78');
    r.mergeAccount('ef56ab78', 'main');
    expect(r.resolveAccount('ab12cd34')).toBe('main');
    expect(r.resolveAccount('ef56ab78')).toBe('main');
  });

  it('a que ficou é removida pela pessoa: a antiga volta a valer a padrão', async () => {
    const r = await fresh({ ...two, defaultId: 'main' });
    r.mergeAccount('ab12cd34', 'ef56ab78');
    r.forgetAccount('ef56ab78');
    expect(r.mergedAccounts()).toEqual({});
    expect(r.resolveAccount('ab12cd34')).toBe('main');
  });

  it('a principal nunca sai, e conta fora da lista não é juntada', async () => {
    const r = await fresh(two);
    r.mergeAccount('main', 'ab12cd34');
    r.mergeAccount('00000000', 'main');
    expect(r.accountIds()).toEqual(['main', 'ab12cd34', 'ef56ab78']);
    expect(r.mergedAccounts()).toEqual({});
    expect(r.trashedAccounts()).toEqual([]);
  });

  it('arquivo com valores estranhos: ignora', async () => {
    const r = await fresh({ accounts: [], merged: { ab12cd34: 42, xx: 'main', ef56ab78: 'ef56ab78' }, trash: ['../x', 7], lost: { main: 'ontem' } });
    expect(r.mergedAccounts()).toEqual({});
    expect(r.trashedAccounts()).toEqual([]);
    expect(r.markLoginLost('main', 1)).toBe(true);
  });
});

// A perda do login vai ao Sentry uma vez por perda (ver markLoginLost).
describe('accounts.json: login perdido', () => {
  beforeEach(() => {
    if (existsSync(registryFile())) writeFileSync(registryFile(), '{}');
  });

  it('marca uma vez, mesmo depois de reabrir, até a conta aparecer logada de novo', async () => {
    const r = await fresh();
    expect(r.markLoginLost('main', 1000)).toBe(true);
    expect(r.markLoginLost('main', 2000)).toBe(false);
    const again = await fresh(JSON.parse(readFileSync(registryFile(), 'utf8')));
    expect(again.markLoginLost('main', 3000)).toBe(false);
    again.clearLoginLost('main');
    expect(again.markLoginLost('main', 4000)).toBe(true);
  });
});

// De quem era o último login de cada conta: fica depois de o login cair (ver Registry.identities).
describe('accounts.json: identidade do login', () => {
  beforeEach(() => {
    if (existsSync(registryFile())) writeFileSync(registryFile(), '{}');
  });

  const ana = { accountUuid: 'acc-1', organizationId: 'org-1', email: 'ana@x.com' };

  it('guarda, mantém depois de reabrir e troca quando o login troca', async () => {
    const r = await fresh();
    expect(r.lastIdentity('main')).toBeUndefined();
    r.rememberIdentity('main', ana);
    const again = await fresh(JSON.parse(readFileSync(registryFile(), 'utf8')));
    expect(again.lastIdentity('main')).toEqual(ana);
    again.rememberIdentity('main', { ...ana, accountUuid: 'acc-2' });
    expect(again.lastIdentity('main')?.accountUuid).toBe('acc-2');
  });

  it('sair pelo app, remover ou juntar a conta leva a identidade junto', async () => {
    const r = await fresh({ accounts: ['ab12cd34', 'ef56ab78'], identities: { main: ana, ab12cd34: ana, ef56ab78: ana } });
    r.forgetLoginMethod('main');
    expect(r.lastIdentity('main')).toBeUndefined();
    r.forgetAccount('ab12cd34');
    expect(r.lastIdentity('ab12cd34')).toBeUndefined();
    r.mergeAccount('ef56ab78', 'main');
    expect(r.lastIdentity('ef56ab78')).toBeUndefined();
  });

  it('arquivo com valores estranhos: ignora', async () => {
    const r = await fresh({ identities: { main: 'ana', ab12cd34: { accountUuid: 7 }, ef56ab78: { email: 'bia@x.com', sobra: true } } });
    expect(r.lastIdentity('main')).toBeUndefined();
    expect(r.lastIdentity('ab12cd34')).toBeUndefined();
    expect(r.lastIdentity('ef56ab78')).toEqual({ email: 'bia@x.com' });
  });
});
