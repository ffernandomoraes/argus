import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MAX_STREAMS_PER_USER, NoticeHub, type Listener } from '../src/modules/notices/notices.hub';
import { createTestContext, type TestContext } from './helpers';

// Avisos entre os computadores da conta: o fluxo aberto num recebe o que o outro manda.

let ctx: TestContext;
let base: string;
let server: ReturnType<TestContext['app']['listen']>;

beforeAll(async () => {
  ctx = await createTestContext();
  server = ctx.app.listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.close();
  await ctx.close();
});

// Abre o fluxo e junta os avisos que chegarem.
async function listen(token: string) {
  const controller = new AbortController();
  const res = await fetch(`${base}/api/notices/stream`, { headers: { authorization: `Bearer ${token}` }, signal: controller.signal });
  const notices: unknown[] = [];
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  void (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let i;
        while ((i = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, i);
          buffer = buffer.slice(i + 2);
          const data = block.split('\n').find((l) => l.startsWith('data: '));
          if (data) notices.push(JSON.parse(data.slice(6)));
        }
      }
    } catch {
      // Fechado pelo teste.
    }
  })();
  const ended = reader.closed.then(
    () => true,
    () => true,
  );
  return { status: res.status, notices, ended, close: () => controller.abort() };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('avisos', () => {
  it('chega nos outros computadores da pessoa, não no que mandou nem em outra pessoa', async () => {
    const home = await ctx.signedIn('nh@teste.com', 'PC de casa');
    const laptop = await ctx.otherDevice(home.user.id, 'Notebook', 'darwin');
    const stranger = await ctx.signedIn('nx@teste.com');
    const onLaptop = await listen(laptop.token);
    const onHome = await listen(home.token);
    const onStranger = await listen(stranger.token);
    expect(onLaptop.status).toBe(200);
    await wait(50);
    const sent = await ctx.as(home.token).post('/api/notices', { title: 'argus: Corrigir login', body: 'Terminou', kind: 'done', hostId: 'room-1' });
    expect(sent.body).toEqual({ sent: 1 });
    await wait(50);
    expect(onLaptop.notices).toEqual([{ from: 'PC de casa', title: 'argus: Corrigir login', body: 'Terminou', kind: 'done', hostId: 'room-1' }]);
    expect(onHome.notices).toEqual([]);
    expect(onStranger.notices).toEqual([]);
    for (const l of [onLaptop, onHome, onStranger]) l.close();
  });

  it('recusa aviso sem título ou de tipo desconhecido, e sem login', async () => {
    const { token } = await ctx.signedIn('nbad@teste.com');
    expect((await ctx.as(token).post('/api/notices', { title: '', kind: 'done' })).status).toBe(400);
    expect((await ctx.as(token).post('/api/notices', { title: 'x', kind: 'spam' })).status).toBe(400);
    expect((await ctx.as(null).post('/api/notices', { title: 'x', kind: 'done' })).status).toBe(401);
  });
});

describe('fluxos que fecham', () => {
  it('aparelho removido: o fluxo dele fecha e os avisos seguintes não vão para ele', async () => {
    const home = await ctx.signedIn('nclose@teste.com', 'PC de casa');
    const laptop = await ctx.otherDevice(home.user.id, 'Notebook', 'darwin');
    const onLaptop = await listen(laptop.token);
    await wait(50);
    expect((await ctx.as(home.token).delete(`/api/devices/${laptop.sessionId}`)).status).toBe(204);
    expect(await onLaptop.ended).toBe(true);
    const sent = await ctx.as(home.token).post('/api/notices', { title: 'x', kind: 'done' });
    expect(sent.body).toEqual({ sent: 0 });
  });

  it('o mesmo computador abrindo de novo fecha o fluxo anterior', async () => {
    const home = await ctx.signedIn('nre@teste.com', 'PC de casa');
    const laptop = await ctx.otherDevice(home.user.id, 'Notebook', 'darwin');
    const first = await listen(laptop.token);
    await wait(30);
    const second = await listen(laptop.token);
    expect(await first.ended).toBe(true);
    await wait(30);
    expect((await ctx.as(home.token).post('/api/notices', { title: 'x', kind: 'done' })).body).toEqual({ sent: 1 });
    second.close();
  });

  it(`no máximo ${MAX_STREAMS_PER_USER} fluxos por pessoa: o mais antigo fecha`, () => {
    const hub = new NoticeHub();
    const closed: string[] = [];
    const fake = (sessionId: string): Listener => ({ sessionId, write: () => true, close: () => closed.push(sessionId) });
    for (let i = 0; i <= MAX_STREAMS_PER_USER; i++) expect(hub.add('ana', fake(`s${i}`))).not.toBeNull();
    expect(closed).toEqual(['s0']);
    expect(hub.size).toBe(MAX_STREAMS_PER_USER);
    expect(hub.send('ana', 'outra', { from: 'x', title: 't', body: '', kind: 'done' })).toBe(MAX_STREAMS_PER_USER);
    hub.closeSession('s5');
    expect(closed).toEqual(['s0', 's5']);
    expect(hub.size).toBe(MAX_STREAMS_PER_USER - 1);
  });
});
