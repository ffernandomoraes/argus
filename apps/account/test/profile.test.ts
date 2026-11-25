import { randomUUID } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as schema from '../src/db/schema';
import { createTestContext, type TestContext } from './helpers';

// Perfil, apagar conta e os acessos dos provedores que não ficam guardados.

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

describe('perfil', () => {
  it('sem sessão, 401', async () => {
    expect((await ctx.as(null).get('/api/me')).status).toBe(401);
    expect((await ctx.as('token-que-nao-existe-1234567890').get('/api/me')).status).toBe(401);
  });

  it('mostra os logins ligados (GitHub e Google da mesma pessoa)', async () => {
    const { user, token } = await ctx.signedIn('perfil@teste.com');
    await ctx.db.update(schema.user).set({ image: 'https://avatars.githubusercontent.com/u/1?v=4' }).where(eq(schema.user.id, user.id));
    for (const providerId of ['github', 'google']) {
      await ctx.db.insert(schema.account).values({ id: randomUUID(), accountId: `${providerId}-1`, providerId, userId: user.id });
    }
    const res = await ctx.as(token).get('/api/me');
    expect(res.body.profile).toEqual({
      id: user.id,
      name: 'Pessoa Teste',
      email: 'perfil@teste.com',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      identities: [
        { provider: 'github', login: null, email: null },
        { provider: 'google', login: null, email: null },
      ],
    });
  });

  it('apagar a conta leva tudo junto', async () => {
    const { user, token } = await ctx.signedIn('apagar@teste.com');
    await ctx.as(token).put('/api/sync', { items: { 'pref.theme': 'dark' } });
    expect((await ctx.as(token).delete('/api/me')).status).toBe(204);
    expect((await ctx.as(token).get('/api/me')).status).toBe(401);
    expect(await ctx.db.select().from(schema.user).where(eq(schema.user.id, user.id))).toEqual([]);
    expect(await ctx.db.select().from(schema.syncItem).where(eq(schema.syncItem.userId, user.id))).toEqual([]);
    expect(await ctx.db.select().from(schema.session).where(eq(schema.session.userId, user.id))).toEqual([]);
  });

  it('o acesso do GitHub ou do Google não fica guardado', async () => {
    const user = await ctx.createUser('tokens@teste.com');
    const context = await ctx.auth.$context;
    await context.internalAdapter.createAccount({
      userId: user.id,
      providerId: 'github',
      accountId: '42',
      accessToken: 'acesso-secreto',
      refreshToken: 'renovacao-secreta',
    });
    const [row] = await ctx.db.select().from(schema.account).where(eq(schema.account.userId, user.id));
    expect(row?.accessToken).toBeNull();
    expect(row?.refreshToken).toBeNull();
  });
});
