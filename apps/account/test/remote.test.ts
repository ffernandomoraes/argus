import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sha256 } from '../src/lib/crypto';
import { browserCookie, createTestContext, PUBLIC_URL, type TestContext } from './helpers';

// Acesso remoto pela conta: o computador de casa publica o código, os outros aparelhos da conta
// veem; e o login do app do celular, que volta para ele com o código depois do #.

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

const WEB = 'https://remote.argusterm.com';
const host = (code = 'K7Q4M-913776', expiresAt = Date.now() + 5 * 60_000) => ({ hostId: 'room-abcdefgh1234', code, expiresAt });

describe('computadores na conta', () => {
  it('o de casa publica, o notebook vê com o código, o próprio não se vê', async () => {
    const home = await ctx.signedIn('rh@teste.com', 'PC de casa');
    const laptop = await ctx.otherDevice(home.user.id, 'Notebook', 'darwin');
    expect((await ctx.as(home.token).put('/api/remote/host', host())).status).toBe(204);
    expect((await ctx.as(home.token).get('/api/remote/hosts')).body).toEqual({ hosts: [] });
    const seen = (await ctx.as(laptop.token).get('/api/remote/hosts')).body.hosts;
    expect(seen).toEqual([expect.objectContaining({ id: home.sessionId, hostId: 'room-abcdefgh1234', name: 'PC de casa', code: 'K7Q4M-913776' })]);

    // Renovar troca o código; desligar tira da lista.
    await ctx.as(home.token).put('/api/remote/host', host('ABCDE-123456'));
    expect((await ctx.as(laptop.token).get('/api/remote/hosts')).body.hosts[0].code).toBe('ABCDE-123456');
    expect((await ctx.as(home.token).delete('/api/remote/host')).status).toBe(204);
    expect((await ctx.as(laptop.token).get('/api/remote/hosts')).body).toEqual({ hosts: [] });
  });

  it('não mostra o de outra pessoa nem o código vencido', async () => {
    const a = await ctx.signedIn('ra@teste.com');
    const b = await ctx.signedIn('rb@teste.com');
    await ctx.as(a.token).put('/api/remote/host', host());
    expect((await ctx.as(b.token).get('/api/remote/hosts')).body).toEqual({ hosts: [] });
    const mine = await ctx.otherDevice(a.user.id);
    await ctx.db.update((await import('../src/db/schema')).remoteHost).set({ codeExpiresAt: new Date(Date.now() - 1000) });
    expect((await ctx.as(mine.token).get('/api/remote/hosts')).body.hosts[0].code).toBeNull();
  });

  it('recusa formato errado e código com prazo longo demais', async () => {
    const { token } = await ctx.signedIn('rbad@teste.com');
    expect((await ctx.as(token).put('/api/remote/host', { ...host(), code: 'x' })).status).toBe(400);
    expect((await ctx.as(token).put('/api/remote/host', { ...host(), hostId: 'a b' })).status).toBe(400);
    expect((await ctx.as(token).put('/api/remote/host', host('K7Q4M-913776', Date.now() + 60 * 60_000))).status).toBe(400);
    expect((await ctx.as(null).get('/api/remote/hosts')).status).toBe(401);
  });
});

describe('login do app do celular', () => {
  const VERIFIER = 'segredo-do-celular-com-mais-de-43-caracteres-x';
  const CHALLENGE = sha256(VERIFIER);

  it('manda para o provedor com o endereço de volta cadastrado', async () => {
    const res = await request(ctx.app).get(`/auth/github/web?challenge=${CHALLENGE}&lang=pt`);
    expect(res.status).toBe(302);
    expect(new URL(res.headers.location ?? '').searchParams.get('redirect_uri')).toBe(`${PUBLIC_URL}/auth/github/callback`);
  });

  it('volta para o app do celular com o código, que vira a sessão do celular', async () => {
    const user = await ctx.createUser('phone@teste.com');
    const browser = await ctx.createSession(user.id);
    const res = await request(ctx.app).get(`/auth/web-finish/${CHALLENGE}`).set('Cookie', browserCookie(browser.token));
    expect(res.status).toBe(302);
    const location = res.headers.location ?? '';
    expect(location.startsWith(`${WEB}/#account=`)).toBe(true);
    const code = new URLSearchParams(location.split('#')[1]).get('account');
    const redeem = await request(ctx.app)
      .post('/api/desktop/redeem')
      .set('Origin', WEB)
      .send({ code, verifier: VERIFIER, device: { name: 'iPhone', platform: 'web' } });
    expect(redeem.status).toBe(200);
    expect(redeem.headers['access-control-allow-origin']).toBe(WEB);
    const devices = (await ctx.as(redeem.body.token).get('/api/devices')).body.devices;
    expect(devices).toEqual([expect.objectContaining({ name: 'iPhone', platform: 'web', current: true })]);
  });

  it('erro e cancelamento voltam para o app do celular', async () => {
    const denied = await request(ctx.app).get('/auth/web-failed/pt?error=access_denied');
    expect(denied.headers.location).toBe(`${WEB}/#account-error=denied`);
    const noSession = await request(ctx.app).get(`/auth/web-finish/${CHALLENGE}`);
    expect(noSession.headers.location).toBe(`${WEB}/#account-error=error`);
    const bad = await request(ctx.app).get('/auth/github/web?challenge=curto');
    expect(bad.headers.location).toBe(`${WEB}/#account-error=error`);
  });
});

describe('CORS', () => {
  it('só o app do celular pode chamar a API do navegador', async () => {
    const pre = await request(ctx.app).options('/api/remote/hosts').set('Origin', WEB).set('Access-Control-Request-Headers', 'authorization');
    expect(pre.status).toBe(204);
    expect(pre.headers['access-control-allow-origin']).toBe(WEB);
    expect(pre.headers['access-control-allow-headers']).toContain('authorization');
    const evil = await request(ctx.app).options('/api/remote/hosts').set('Origin', 'https://evil.example');
    expect(evil.headers['access-control-allow-origin']).toBeUndefined();
  });
});
