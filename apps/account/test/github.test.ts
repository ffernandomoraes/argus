import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { githubLink } from '../src/db/schema';
import { sha256 } from '../src/lib/crypto';
import { githubHttp } from '../src/modules/github/github.client';
import { createTestContext, type TestContext } from './helpers';

// Conectar o GitHub (app só de leitura) e usar a conexão: o navegador passa pelo GitHub e volta ao
// app com um código que só vale com o segredo do app; a chave fica cifrada e é renovada sozinha.

let ctx: TestContext;
const VERIFIER = 'segredo-do-app-com-mais-de-quarenta-e-tres-letras';
const CHALLENGE = sha256(VERIFIER);
const realFetch = githubHttp.fetch;

type Fake = { tokens: number; refreshOk: boolean; revoked: string[]; installs: number };
let fake: Fake;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  githubHttp.fetch = realFetch;
  await ctx.close();
});

beforeEach(() => {
  fake = { tokens: 0, refreshOk: true, revoked: [], installs: 1 };
  githubHttp.fetch = async (url, init) => {
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : {};
    if (url.endsWith('/login/oauth/access_token')) {
      if (body.grant_type === 'refresh_token' && !fake.refreshOk) return json({ error: 'bad_refresh_token' });
      fake.tokens++;
      return json({ access_token: `ghu_${fake.tokens}`, expires_in: 28800, refresh_token: `ghr_${fake.tokens}`, refresh_token_expires_in: 15897600 });
    }
    if (url.endsWith('/user')) return json({ id: 42, login: 'ana' });
    if (url.endsWith('/user/installations?per_page=1')) return json({ total_count: fake.installs });
    if (url.includes('/user/installations?')) {
      return json({ installations: [{ id: 7, account: { login: 'eduzz-design', type: 'Organization' }, repository_selection: 'selected', html_url: 'https://github.com/organizations/eduzz-design/settings/installations/7' }] });
    }
    if (url.includes('/user/installations/7/repositories')) {
      return json({
        repositories: [
          { full_name: 'ana/velho', name: 'velho', owner: { login: 'ana' }, private: false, pushed_at: '2025-01-01T00:00:00Z', clone_url: 'https://github.com/ana/velho.git' },
          { full_name: 'ana/argus', name: 'argus', owner: { login: 'ana' }, private: true, pushed_at: '2026-11-01T00:00:00Z', clone_url: 'https://github.com/ana/argus.git' },
        ],
      });
    }
    if (url.includes('/applications/gh-app-id/grant')) {
      fake.revoked.push(body.access_token ?? '');
      return new Response(null, { status: 204 });
    }
    return new Response('não esperado', { status: 500 });
  };
});

// Começa no app, passa pelo GitHub e devolve o código que voltou ao app.
async function browserTrip(): Promise<string> {
  const start = await request(ctx.app).get(`/github/start?port=50123&challenge=${CHALLENGE}&lang=pt`);
  expect(start.status).toBe(302);
  const authorize = new URL(start.headers.location as string);
  expect(authorize.origin + authorize.pathname).toBe('https://github.com/login/oauth/authorize');
  expect(authorize.searchParams.get('client_id')).toBe('gh-app-id');
  const back = await request(ctx.app).get(`/github/callback?code=gh-code&state=${authorize.searchParams.get('state')}`);
  const toApp = new URL(back.headers.location as string);
  expect(toApp.origin).toBe('http://127.0.0.1:50123');
  return toApp.searchParams.get('code')!;
}

describe('conectar o GitHub', () => {
  it('conecta à conta de quem mostra o segredo, com a chave cifrada no banco', async () => {
    const me = await ctx.signedIn('gh-a@teste.com');
    const code = await browserTrip();
    const linked = await ctx.as(me.token).post('/api/github/link', { code, verifier: VERIFIER });
    expect(linked.body).toEqual({ login: 'ana', installed: true, installUrl: 'https://github.com/apps/argus-test/installations/new' });
    expect((await ctx.as(me.token).get('/api/github')).body).toEqual({ available: true, login: 'ana', installUrl: expect.any(String) });
    const [row] = await ctx.db.select().from(githubLink).where(eq(githubLink.userId, me.user.id));
    expect(row?.accessToken).not.toContain('ghu_');
    expect(row?.refreshToken).not.toContain('ghr_');
    // Código de uso único.
    expect((await ctx.as(me.token).post('/api/github/link', { code, verifier: VERIFIER })).status).toBe(400);
  });

  it('recusa o código sem o segredo certo e avisa quando nada foi liberado ainda', async () => {
    const me = await ctx.signedIn('gh-b@teste.com');
    expect((await ctx.as(me.token).post('/api/github/link', { code: await browserTrip(), verifier: `${VERIFIER}x` })).status).toBe(400);
    fake.installs = 0;
    const linked = await ctx.as(me.token).post('/api/github/link', { code: await browserTrip(), verifier: VERIFIER });
    expect(linked.body.installed).toBe(false);
  });

  it('volta ao app com o erro quando a pessoa cancela no GitHub', async () => {
    const start = await request(ctx.app).get(`/github/start?port=50124&challenge=${CHALLENGE}&lang=pt`);
    const state = new URL(start.headers.location as string).searchParams.get('state');
    const back = await request(ctx.app).get(`/github/callback?error=access_denied&state=${state}`);
    expect(back.headers.location).toBe('http://127.0.0.1:50124/callback?error=denied');
    expect((await request(ctx.app).get(`/github/callback?code=x&state=${state}`)).status).toBe(200);
  });
});

describe('usar a conexão', () => {
  it('lista os repositórios do mais mexido e entrega a chave para o clone', async () => {
    const me = await ctx.signedIn('gh-c@teste.com');
    await ctx.as(me.token).post('/api/github/link', { code: await browserTrip(), verifier: VERIFIER });
    const repos = (await ctx.as(me.token).get('/api/github/repos')).body.repos;
    expect(repos.map((r: { fullName: string }) => r.fullName)).toEqual(['ana/argus', 'ana/velho']);
    expect(repos[0]).toMatchObject({ private: true, cloneUrl: 'https://github.com/ana/argus.git' });
    expect((await ctx.as(me.token).get('/api/github/installations')).body.installations).toEqual([
      { id: 7, account: 'eduzz-design', organization: true, selection: 'selected', manageUrl: 'https://github.com/organizations/eduzz-design/settings/installations/7' },
    ]);
    const token = (await ctx.as(me.token).post('/api/github/token')).body;
    expect(token.token).toMatch(/^ghu_/);
  });

  it('renova a chave perto de vencer e desconecta quando a renovação é recusada', async () => {
    const me = await ctx.signedIn('gh-d@teste.com');
    await ctx.as(me.token).post('/api/github/link', { code: await browserTrip(), verifier: VERIFIER });
    const first = (await ctx.as(me.token).post('/api/github/token')).body.token;
    await ctx.db.update(githubLink).set({ accessExpiresAt: new Date(Date.now() + 60_000) }).where(eq(githubLink.userId, me.user.id));
    const renewed = (await ctx.as(me.token).post('/api/github/token')).body.token;
    expect(renewed).not.toBe(first);

    await ctx.db.update(githubLink).set({ accessExpiresAt: new Date(Date.now() - 1000) }).where(eq(githubLink.userId, me.user.id));
    fake.refreshOk = false;
    const gone = await ctx.as(me.token).post('/api/github/token');
    expect(gone.status).toBe(409);
    expect(gone.body).toEqual({ error: 'notConnected' });
    expect((await ctx.as(me.token).get('/api/github')).body).toEqual({ available: true });
  });

  it('desconectar apaga e desfaz a autorização no GitHub; outra pessoa não vê nada', async () => {
    const me = await ctx.signedIn('gh-e@teste.com');
    const other = await ctx.signedIn('gh-f@teste.com');
    await ctx.as(me.token).post('/api/github/link', { code: await browserTrip(), verifier: VERIFIER });
    expect((await ctx.as(other.token).get('/api/github/repos')).status).toBe(409);
    expect((await ctx.as(me.token).delete('/api/github')).status).toBe(204);
    expect(fake.revoked).toHaveLength(1);
    expect(fake.revoked[0]).toMatch(/^ghu_/);
    expect((await ctx.as(me.token).get('/api/github')).body).toEqual({ available: true });
    expect((await ctx.as(null).get('/api/github')).status).toBe(401);
  });

  it('desconectar com a chave vencida renova antes, para o GitHub aceitar desfazer', async () => {
    const me = await ctx.signedIn('gh-g@teste.com');
    await ctx.as(me.token).post('/api/github/link', { code: await browserTrip(), verifier: VERIFIER });
    const linked = fake.tokens;
    await ctx.db.update(githubLink).set({ accessExpiresAt: new Date(Date.now() - 1000) }).where(eq(githubLink.userId, me.user.id));
    expect((await ctx.as(me.token).delete('/api/github')).status).toBe(204);
    expect(fake.revoked).toEqual([`ghu_${linked + 1}`]);
  });

  it('apagar a conta desfaz a autorização no GitHub', async () => {
    const me = await ctx.signedIn('gh-h@teste.com');
    await ctx.as(me.token).post('/api/github/link', { code: await browserTrip(), verifier: VERIFIER });
    expect((await ctx.as(me.token).delete('/api/me')).status).toBe(204);
    expect(fake.revoked).toHaveLength(1);
    expect(await ctx.db.select().from(githubLink).where(eq(githubLink.userId, me.user.id))).toEqual([]);
  });

  it('GitHub recusando desfazer não impede desconectar', async () => {
    const me = await ctx.signedIn('gh-i@teste.com');
    await ctx.as(me.token).post('/api/github/link', { code: await browserTrip(), verifier: VERIFIER });
    const real = githubHttp.fetch;
    githubHttp.fetch = async (url, init) => (url.includes('/grant') ? new Response('{}', { status: 422 }) : real(url, init));
    expect((await ctx.as(me.token).delete('/api/github')).status).toBe(204);
    expect((await ctx.as(me.token).get('/api/github')).body).toEqual({ available: true });
  });
});
