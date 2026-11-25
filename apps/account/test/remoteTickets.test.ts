import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as schema from '../src/db/schema';
import { noticeHub } from '../src/modules/notices/notices.hub';
import { createTestContext, type TestContext } from './helpers';

// Pareamento pela conta preso à sessão de quem pareou: o bilhete, a troca pelo computador de casa e a
// conferência de quais sessões ainda valem.

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

const HOST_ID = 'room-tickets-1234';
const publish = (token: string, hostId = HOST_ID) =>
  ctx.as(token).put('/api/remote/host', { hostId, code: 'K7Q4M-913776', expiresAt: Date.now() + 5 * 60_000 });

async function household(email: string) {
  const home = await ctx.signedIn(email, 'PC de casa');
  const phone = await ctx.otherDevice(home.user.id, 'iPhone', 'web');
  await publish(home.token);
  return { home, phone };
}

describe('bilhete do pareamento pela conta', () => {
  it('o celular pede, o computador de casa troca pela sessão do celular, uma vez só', async () => {
    const { home, phone } = await household('tk-a@teste.com');
    const issued = await ctx.as(phone.token).post('/api/remote/ticket', { hostId: HOST_ID });
    expect(issued.status).toBe(200);
    const claim = await ctx.as(home.token).post('/api/remote/claim', { ticket: issued.body.ticket });
    expect(claim.body).toEqual({ sessionId: phone.sessionId, name: 'iPhone', platform: 'web' });
    expect((await ctx.as(home.token).post('/api/remote/claim', { ticket: issued.body.ticket })).status).toBe(404);
  });

  it('só para um computador da própria conta que aceita acesso, e não para si mesmo', async () => {
    const { home, phone } = await household('tk-b@teste.com');
    const stranger = await ctx.signedIn('tk-x@teste.com');
    expect((await ctx.as(stranger.token).post('/api/remote/ticket', { hostId: HOST_ID })).status).toBe(404);
    expect((await ctx.as(home.token).post('/api/remote/ticket', { hostId: HOST_ID })).status).toBe(404);
    expect((await ctx.as(phone.token).post('/api/remote/ticket', { hostId: 'room-outro-12345' })).status).toBe(404);
    expect((await ctx.as(phone.token).post('/api/remote/ticket', { hostId: 'a b' })).status).toBe(400);
  });

  it('outro computador da conta, ou de outra pessoa, não troca o bilhete', async () => {
    const { home, phone } = await household('tk-c@teste.com');
    const laptop = await ctx.otherDevice(home.user.id, 'Notebook', 'darwin');
    await publish(laptop.token, 'room-laptop-12345');
    const ticket = (await ctx.as(phone.token).post('/api/remote/ticket', { hostId: HOST_ID })).body.ticket as string;
    expect((await ctx.as(laptop.token).post('/api/remote/claim', { ticket })).status).toBe(404);
    // Gasto na tentativa errada: o celular pede outro.
    expect((await ctx.as(home.token).post('/api/remote/claim', { ticket })).status).toBe(404);
    const again = (await ctx.as(phone.token).post('/api/remote/ticket', { hostId: HOST_ID })).body.ticket as string;
    const stranger = await ctx.signedIn('tk-y@teste.com');
    await publish(stranger.token);
    expect((await ctx.as(stranger.token).post('/api/remote/claim', { ticket: again })).status).toBe(404);
  });

  it('quem pediu saiu da conta antes da troca: não vale', async () => {
    const { home, phone } = await household('tk-d@teste.com');
    const ticket = (await ctx.as(phone.token).post('/api/remote/ticket', { hostId: HOST_ID })).body.ticket as string;
    await ctx.as(home.token).delete(`/api/devices/${phone.sessionId}`);
    expect((await ctx.as(home.token).post('/api/remote/claim', { ticket })).status).toBe(404);
  });
});

describe('sessões dos pareados pela conta', () => {
  it('diz quais ainda valem, de quem pergunta, e conta a entrada como uso', async () => {
    const { home, phone } = await household('tk-e@teste.com');
    const gone = await ctx.otherDevice(home.user.id, 'Velho', 'web');
    const stranger = await ctx.signedIn('tk-z@teste.com');
    await ctx.as(home.token).delete(`/api/devices/${gone.sessionId}`);
    const soon = new Date(Date.now() + 60_000);
    await ctx.db.update(schema.session).set({ expiresAt: soon }).where(eq(schema.session.id, phone.sessionId));
    const r = await ctx.as(home.token).post('/api/remote/check', { ids: [phone.sessionId, gone.sessionId, stranger.sessionId], seen: [phone.sessionId] });
    expect(r.body).toEqual({ alive: [phone.sessionId] });
    const [row] = await ctx.db.select().from(schema.session).where(eq(schema.session.id, phone.sessionId));
    expect(row!.expiresAt.getTime()).toBeGreaterThan(Date.now() + 100 * 86_400_000);
    expect((await ctx.as(home.token).post('/api/remote/check', { ids: 'x' })).status).toBe(400);
  });
});

describe('aparelho saindo da conta', () => {
  it('os outros computadores ligados ficam sabendo', async () => {
    const { home, phone } = await household('tk-f@teste.com');
    const got: string[] = [];
    const remove = noticeHub.add(home.user.id, { sessionId: home.sessionId, write: (chunk) => (got.push(chunk), true), close: () => undefined });
    await ctx.as(home.token).delete(`/api/devices/${phone.sessionId}`);
    expect(got).toEqual([`event: device-removed\ndata: ${JSON.stringify({ id: phone.sessionId })}\n\n`]);
    remove?.();
  });
});
