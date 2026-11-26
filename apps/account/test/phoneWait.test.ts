import { eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as schema from '../src/db/schema';
import { randomToken, sha256 } from '../src/lib/crypto';
import { confirmCodeOf } from '../src/modules/desktop/desktop.codes';
import { browserCookie, createTestContext, type TestContext } from './helpers';

// O login do app do celular instalado: o navegador termina numa página de confirmação e o app pega a
// sessão sozinho, perguntando com o segredo (/api/desktop/redeem-wait).

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

const poll = (verifier: string) => ctx.as(null).post('/api/desktop/redeem-wait', { verifier, device: { name: 'iPhone', platform: 'web' } });

describe('login do celular instalado', () => {
  it('começa no provedor e recusa challenge que não é do app', async () => {
    const res = await request(ctx.app).get(`/auth/github/wait?challenge=${sha256(randomToken())}&lang=pt`);
    expect(res.status).toBe(302);
    expect(new URL(res.headers.location ?? '').host).toBe('github.com');
    const bad = await request(ctx.app).get('/auth/github/wait?challenge=curto&lang=pt');
    expect(bad.status).toBe(400);
    expect(bad.text).toContain('Não deu para entrar');
  });

  it('o app espera, a página confirma com o código e o app entra uma vez só', async () => {
    const verifier = randomToken();
    const challenge = sha256(verifier);
    const user = await ctx.createUser('celular@teste.com');
    const browser = await ctx.createSession(user.id);

    expect((await poll(verifier)).status).toBe(202);

    const page = await request(ctx.app).get(`/auth/web-confirm/${challenge}/pt`).set('Cookie', browserCookie(browser.token));
    expect(page.status).toBe(200);
    expect(page.text).toContain(confirmCodeOf(challenge));
    expect(page.headers['content-security-policy']).toContain("form-action 'self'");

    const done = await request(ctx.app).post(`/auth/web-confirm/${challenge}/pt`).set('Cookie', browserCookie(browser.token));
    expect(done.status).toBe(200);
    expect(done.text).toContain('Volte ao <strong>app do Argus</strong>');
    expect(await ctx.db.select().from(schema.session).where(eq(schema.session.id, browser.id))).toEqual([]);

    const signed = await poll(verifier);
    expect(signed.status).toBe(200);
    expect(signed.body.profile.email).toBe('celular@teste.com');
    expect((await ctx.as(signed.body.token).get('/api/me')).status).toBe(200);
    expect((await poll(verifier)).status).toBe(202);
  });

  it('outro segredo não pega o login de ninguém', async () => {
    const verifier = randomToken();
    const user = await ctx.createUser('dono@teste.com');
    const browser = await ctx.createSession(user.id);
    await request(ctx.app).post(`/auth/web-confirm/${sha256(verifier)}/pt`).set('Cookie', browserCookie(browser.token));
    expect((await poll(randomToken())).status).toBe(202);
    expect((await poll(verifier)).status).toBe(200);
  });

  it('sem a sessão do navegador (ou com a de um aparelho), não confirma', async () => {
    const challenge = sha256(randomToken());
    expect((await request(ctx.app).get(`/auth/web-confirm/${challenge}/pt`)).text).toContain('O login demorou demais');
    const { token } = await ctx.signedIn('aparelho@teste.com');
    const res = await request(ctx.app).post(`/auth/web-confirm/${challenge}/pt`).set('Cookie', browserCookie(token));
    expect(res.text).toContain('O login demorou demais');
    expect(await ctx.db.select().from(schema.desktopLoginCode).where(eq(schema.desktopLoginCode.challenge, challenge))).toEqual([]);
  });

  it('confirmado há mais de 5 minutos não vale', async () => {
    const verifier = randomToken();
    const challenge = sha256(verifier);
    const user = await ctx.createUser('lento@teste.com');
    const browser = await ctx.createSession(user.id);
    await request(ctx.app).post(`/auth/web-confirm/${challenge}/pt`).set('Cookie', browserCookie(browser.token));
    await ctx.db.update(schema.desktopLoginCode).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(schema.desktopLoginCode.challenge, challenge));
    expect((await poll(verifier)).status).toBe(401);
  });

  it('código curto de 6 letras sem as que se confundem', () => {
    expect(confirmCodeOf(sha256('qualquer'))).toMatch(/^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/);
    // Fixo: o app do celular calcula o mesmo (apps/mobile/src/net/loginWait.ts).
    expect(confirmCodeOf(`AAAAAQ${'A'.repeat(37)}`)).toBe('BAA-AAA');
  });
});
