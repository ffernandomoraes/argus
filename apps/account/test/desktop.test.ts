import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as schema from '../src/db/schema';
import { randomToken, sha256 } from '../src/lib/crypto';
import { cleanDevice } from '../src/modules/desktop/desktop.codes';
import { browserCookie, createTestContext, PUBLIC_URL, type TestContext } from './helpers';

// O login do app do computador, do começo no navegador até a sessão do aparelho.

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

const CHALLENGE = sha256('segredo do teste');

// Fim do login no navegador: a sessão do navegador vira um código para o app.
async function finishLogin(email: string, challenge: string) {
  const user = await ctx.createUser(email);
  const browser = await ctx.createSession(user.id);
  const res = await request(ctx.app).get(`/auth/finish/51234/${challenge}/pt`).set('Cookie', browserCookie(browser.token));
  return { user, browser, res, code: new URL(res.headers.location ?? 'http://x').searchParams.get('code') };
}

describe('começo do login', () => {
  it('manda para o GitHub com o endereço de volta cadastrado', async () => {
    const res = await request(ctx.app).get(`/auth/github/start?port=51234&challenge=${CHALLENGE}&lang=pt`);
    expect(res.status).toBe(302);
    const url = new URL(res.headers.location ?? '');
    expect(`${url.origin}${url.pathname}`).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('client_id')).toBe('github-id');
    expect(url.searchParams.get('redirect_uri')).toBe(`${PUBLIC_URL}/auth/github/callback`);
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('no Google, deixa escolher a conta', async () => {
    const res = await request(ctx.app).get(`/auth/google/start?port=51234&challenge=${CHALLENGE}&lang=en`);
    const url = new URL(res.headers.location ?? '');
    expect(url.host).toBe('accounts.google.com');
    expect(url.searchParams.get('redirect_uri')).toBe(`${PUBLIC_URL}/auth/google/callback`);
    expect(url.searchParams.get('prompt')).toBe('select_account');
  });

  it('recusa porta, challenge e provedor que não são do app', async () => {
    expect((await request(ctx.app).get(`/auth/github/start?port=80&challenge=${CHALLENGE}`)).status).toBe(400);
    expect((await request(ctx.app).get('/auth/github/start?port=51234&challenge=curto')).status).toBe(400);
    expect((await request(ctx.app).get(`/auth/gitlab/start?port=51234&challenge=${CHALLENGE}`)).status).toBe(400);
  });
});

describe('volta do provedor', () => {
  it('o endereço cadastrado repassa para o Better Auth', async () => {
    const res = await request(ctx.app).get('/auth/github/callback?code=abc&state=xyz');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/api/auth/callback/github?code=abc&state=xyz');
  });

  it('cancelado no provedor volta ao app como "denied"; outro erro, como "error"', async () => {
    const denied = await request(ctx.app).get('/auth/failed/51234/pt?error=access_denied');
    expect(denied.headers.location).toBe('http://127.0.0.1:51234/callback?error=denied');
    const other = await request(ctx.app).get('/auth/failed/51234/pt?error=account_not_linked');
    expect(other.headers.location).toBe('http://127.0.0.1:51234/callback?error=error');
  });

  it('sem sessão no navegador, volta ao app com erro', async () => {
    const res = await request(ctx.app).get(`/auth/finish/51234/${CHALLENGE}/pt`);
    expect(res.headers.location).toBe('http://127.0.0.1:51234/callback?error=error');
  });
});

describe('código do login', () => {
  it('a sessão do navegador vira um código e deixa de existir', async () => {
    const { res, code, browser } = await finishLogin('fim@teste.com', CHALLENGE);
    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/^http:\/\/127\.0\.0\.1:51234\/callback\?code=[A-Za-z0-9_-]{43}$/);
    expect(code).toBeTruthy();
    const left = await ctx.db.select().from(schema.session).where(eq(schema.session.id, browser.id));
    expect(left).toEqual([]);
  });

  it('com o segredo certo vira a sessão do aparelho, uma vez só', async () => {
    const verifier = randomToken();
    const { code, user } = await finishLogin('troca@teste.com', sha256(verifier));
    const body = { code, verifier, device: { name: 'Mac do Fernando', platform: 'darwin' } };
    const res = await ctx.as(null).post('/api/desktop/redeem', body);
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({ id: user.id, email: 'troca@teste.com', name: 'Pessoa Teste' });
    const me = await ctx.as(res.body.token as string).get('/api/me');
    expect(me.status).toBe(200);
    expect((await ctx.as(null).post('/api/desktop/redeem', body)).status).toBe(401);
  });

  it('segredo errado não vale, e o código se perde', async () => {
    const verifier = randomToken();
    const { code } = await finishLogin('errado@teste.com', sha256(verifier));
    expect((await ctx.as(null).post('/api/desktop/redeem', { code, verifier: randomToken() })).status).toBe(401);
    expect((await ctx.as(null).post('/api/desktop/redeem', { code, verifier })).status).toBe(401);
  });

  it('corpo fora do formato é recusado', async () => {
    expect((await ctx.as(null).post('/api/desktop/redeem', { code: 'x', verifier: 'y' })).status).toBe(400);
  });
});

describe('aparelhos', () => {
  it('lista os computadores, marca este e tira outro', async () => {
    const { user, token, sessionId } = await ctx.signedIn('aparelhos@teste.com', 'Mac');
    const other = await ctx.createSession(user.id);
    await ctx.db.insert(schema.desktopDevice).values({ sessionId: other.id, name: 'PC de casa', platform: 'win32' });

    const list = await ctx.as(token).get('/api/devices');
    expect(list.status).toBe(200);
    const devices = list.body.devices as { id: string; name: string; current: boolean }[];
    expect(devices.map((d) => [d.name, d.current]).sort()).toEqual([
      ['Mac', true],
      ['PC de casa', false],
    ]);
    expect(devices.find((d) => d.current)?.id).toBe(sessionId);

    expect((await ctx.as(token).delete(`/api/devices/${other.id}`)).status).toBe(204);
    expect((await ctx.as(other.token).get('/api/me')).status).toBe(401);
    expect((await ctx.as(token).delete(`/api/devices/${other.id}`)).status).toBe(404);
  });

  it('não mexe no aparelho de outra pessoa', async () => {
    const a = await ctx.signedIn('dono@teste.com');
    const b = await ctx.signedIn('intruso@teste.com');
    expect((await ctx.as(b.token).delete(`/api/devices/${a.sessionId}`)).status).toBe(404);
    expect((await ctx.as(a.token).get('/api/me')).status).toBe(200);
  });

  it('sair encerra a sessão deste aparelho', async () => {
    const { token } = await ctx.signedIn('sair@teste.com');
    expect((await ctx.as(token).post('/api/logout')).status).toBe(204);
    expect((await ctx.as(token).get('/api/me')).status).toBe(401);
  });

  it('nome do aparelho sem caracteres de controle e com limite', () => {
    expect(cleanDevice({ name: 'Mac\u0000 do‮Fernando', platform: 'darwin' })).toEqual({ name: 'Mac doFernando', platform: 'darwin' });
    expect(cleanDevice({ name: 'x'.repeat(100), platform: 'beos' })).toEqual({ name: 'x'.repeat(64), platform: 'other' });
    expect(cleanDevice(undefined)).toEqual({ name: 'Argus', platform: 'other' });
  });
});

describe('portas fechadas do Better Auth', () => {
  it('só a volta do provedor fica aberta; listar sessões e entrar por POST não existem', async () => {
    const { token } = await ctx.signedIn('superficie@teste.com');
    expect((await ctx.as(token).get('/api/auth/list-sessions')).status).toBe(404);
    expect((await ctx.as(token).get('/api/auth/get-session')).status).toBe(404);
    expect((await ctx.as(null).post('/api/auth/sign-in/social', { provider: 'github', callbackURL: '/' })).status).toBe(404);
    const back = await request(ctx.app).get('/api/auth/callback/github?code=abc&state=xyz');
    expect(back.status).toBe(302);
    expect(back.headers.location?.startsWith(`${PUBLIC_URL}/auth/done`)).toBe(true);
  });

  it('o token de um aparelho não vira código de login (nem pelo cabeçalho, nem pelo cookie)', async () => {
    const { token, sessionId } = await ctx.signedIn('lavagem@teste.com');
    const byHeader = await request(ctx.app).get(`/auth/finish/51234/${CHALLENGE}/pt`).set('Authorization', `Bearer ${token}`);
    expect(byHeader.headers.location).toBe('http://127.0.0.1:51234/callback?error=error');
    const byCookie = await request(ctx.app).get(`/auth/web-finish/${CHALLENGE}`).set('Cookie', browserCookie(token));
    expect(byCookie.headers.location).toMatch(/#account-error=error$/);
    expect(await ctx.db.select().from(schema.session).where(eq(schema.session.id, sessionId))).toHaveLength(1);
    expect((await ctx.as(token).get('/api/me')).status).toBe(200);
  });

  it('a sessão do navegador não abre a API, e o cookie de um aparelho também não', async () => {
    const user = await ctx.createUser('meio-do-login@teste.com');
    const browser = await ctx.createSession(user.id);
    expect((await ctx.as(browser.token).get('/api/me')).status).toBe(401);
    const { token } = await ctx.signedIn('cookie@teste.com');
    expect((await request(ctx.app).get('/api/me').set('Cookie', browserCookie(token))).status).toBe(401);
  });

  it('login largado no meio não vale depois de 15 minutos e a sessão sai', async () => {
    const user = await ctx.createUser('largado@teste.com');
    const browser = await ctx.createSession(user.id);
    await ctx.db.update(schema.session).set({ createdAt: new Date(Date.now() - 16 * 60_000) }).where(eq(schema.session.id, browser.id));
    const res = await request(ctx.app).get(`/auth/finish/51234/${CHALLENGE}/pt`).set('Cookie', browserCookie(browser.token));
    expect(res.headers.location).toBe('http://127.0.0.1:51234/callback?error=error');
    expect(await ctx.db.select().from(schema.session).where(eq(schema.session.id, browser.id))).toEqual([]);
  });

  it('cada login novo tira as sessões de navegador largadas, e não as dos aparelhos', async () => {
    const user = await ctx.createUser('varrer@teste.com');
    const old = await ctx.createSession(user.id);
    await ctx.db.update(schema.session).set({ createdAt: new Date(Date.now() - 60 * 60_000) }).where(eq(schema.session.id, old.id));
    const device = await ctx.signedIn('varrer-aparelho@teste.com');
    await ctx.db.update(schema.session).set({ createdAt: new Date(Date.now() - 60 * 60_000) }).where(eq(schema.session.id, device.sessionId));
    await request(ctx.app).get(`/auth/github/start?port=51234&challenge=${CHALLENGE}&lang=pt`);
    expect(await ctx.db.select().from(schema.session).where(eq(schema.session.id, old.id))).toEqual([]);
    expect((await ctx.as(device.token).get('/api/me')).status).toBe(200);
  });
});

describe('página final', () => {
  it('mostra o resultado no idioma do app', async () => {
    const ok = await request(ctx.app).get('/auth/done?status=ok&lang=pt');
    expect(ok.status).toBe(200);
    expect(ok.text).toContain('Você entrou no Argus');
    const error = await request(ctx.app).get('/auth/done?status=qualquer&lang=en');
    expect(error.status).toBe(400);
    expect(error.text).toContain("Couldn't sign you in");
  });
});
