import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MAX_KEYS, parseWrite } from '../src/modules/sync/sync.service';
import { createTestContext, type TestContext } from './helpers';

// Preferências sincronizadas: gravar, ler o que mudou depois de uma versão e os limites.

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

describe('sincronização', () => {
  it('grava e devolve o que mudou depois da versão', async () => {
    const { token } = await ctx.signedIn('sync@teste.com');
    const api = ctx.as(token);
    expect((await api.get('/api/sync?since=0')).body).toEqual({ items: [], version: 0 });

    const first = await api.put('/api/sync', { items: { 'pref.theme': 'dark', 'pref.conversation': { model: 'opus', effort: 'high' } } });
    expect(first.body).toEqual({ version: 1 });
    const all = await api.get('/api/sync?since=0');
    expect(all.body.version).toBe(1);
    expect(all.body.items).toEqual([
      { key: 'pref.theme', value: 'dark' },
      { key: 'pref.conversation', value: { model: 'opus', effort: 'high' } },
    ]);

    expect((await api.put('/api/sync', { items: { 'pref.theme': 'light' } })).body).toEqual({ version: 2 });
    const changed = await api.get('/api/sync?since=1');
    expect(changed.body).toEqual({ items: [{ key: 'pref.theme', value: 'light' }], version: 2 });
    expect((await api.get('/api/sync?since=2')).body).toEqual({ items: [], version: 2 });
  });

  it('cada pessoa vê só as dela', async () => {
    const a = await ctx.signedIn('a@sync.com');
    const b = await ctx.signedIn('b@sync.com');
    await ctx.as(a.token).put('/api/sync', { items: { 'pref.language': 'pt' } });
    expect((await ctx.as(b.token).get('/api/sync?since=0')).body).toEqual({ items: [], version: 0 });
  });

  it('recusa corpo estranho, chave inválida, valor nulo e valor grande', async () => {
    const { token } = await ctx.signedIn('limites@sync.com');
    const api = ctx.as(token);
    expect((await api.put('/api/sync', { items: {} })).status).toBe(400);
    expect((await api.put('/api/sync', { items: { 'Pref.x': 1 } })).status).toBe(400);
    expect((await api.put('/api/sync', { items: { 'pref.x': null } })).status).toBe(400);
    expect((await api.put('/api/sync', { items: { 'pref.x': 'a'.repeat(40_000) } })).status).toBe(400);
    expect((await ctx.as(null).get('/api/sync?since=0')).status).toBe(401);
  });

  it(`não passa de ${MAX_KEYS} preferências por pessoa`, async () => {
    const { token } = await ctx.signedIn('muitas@sync.com');
    const api = ctx.as(token);
    for (let start = 0; start < MAX_KEYS; start += 50) {
      const items = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`pref.k${start + i}`, i]));
      expect((await api.put('/api/sync', { items })).status).toBe(200);
    }
    expect((await api.put('/api/sync', { items: { 'pref.k0': 'de novo' } })).status).toBe(200);
    expect((await api.put('/api/sync', { items: { 'pref.nova': 1 } })).status).toBe(413);
  });

  it('parseWrite confere o formato', () => {
    expect(parseWrite(null)).toBe('invalid items');
    expect(parseWrite({ items: [] })).toBe('invalid items');
    expect(parseWrite({ items: { '../x': 1 } })).toMatch(/^invalid key/);
    expect(parseWrite({ items: { 'pref.ok': false } })).toEqual(new Map([['pref.ok', false]]));
  });
});
