import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as schema from '../src/db/schema';
import { WORKSPACE_SENDS_PER_HOUR } from '../src/modules/workspaces/workspaces.module';
import { createTestContext, type TestContext } from './helpers';

// Workspaces de cada computador: um manda, o outro vê e traz.

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.close();
});

const snapshot = (name: string) => ({
  boards: [{ id: 'main', name, nodes: [{ id: 'p', type: 'project', position: { x: 0, y: 0 }, data: { path: '~/a' } }] }],
  folders: { '~/a': { remote: 'github.com/ana/a' } },
});

describe('workspaces', () => {
  it('cada computador vê os dos outros, não os próprios', async () => {
    const mac = await ctx.signedIn('ws@teste.com');
    const pc = await ctx.otherDevice(mac.user.id);
    expect((await ctx.as(mac.token).put('/api/workspaces', { snapshot: snapshot('Principal') })).status).toBe(204);
    expect((await ctx.as(mac.token).get('/api/workspaces')).body).toEqual({ computers: [] });

    const seen = await ctx.as(pc.token).get('/api/workspaces');
    expect(seen.body.computers).toHaveLength(1);
    // A lista vem só com o resumo; o desenho inteiro, só pedindo um computador.
    expect(seen.body.computers[0]).toEqual({
      id: mac.sessionId,
      name: 'Mac do teste',
      platform: 'darwin',
      updatedAt: expect.any(Number),
      boards: [{ id: 'main', name: 'Principal', folders: 1, groups: 0, notes: 0 }],
    });

    // Mandar de novo troca o anterior.
    await ctx.as(mac.token).put('/api/workspaces', { snapshot: snapshot('Trabalho') });
    const one = await ctx.as(pc.token).get(`/api/workspaces/${mac.sessionId}`);
    expect(one.body.computer.snapshot.boards[0].name).toBe('Trabalho');
    expect((await ctx.as(mac.token).get(`/api/workspaces/${pc.sessionId}`)).status).toBe(404);
  });

  it('não mostra os de outra pessoa', async () => {
    const a = await ctx.signedIn('wa@teste.com');
    const b = await ctx.signedIn('wb@teste.com');
    await ctx.as(a.token).put('/api/workspaces', { snapshot: snapshot('A') });
    expect((await ctx.as(b.token).get('/api/workspaces')).body).toEqual({ computers: [] });
    expect((await ctx.as(b.token).get(`/api/workspaces/${a.sessionId}`)).status).toBe(404);
  });

  it('some quando o computador sai da conta', async () => {
    const mac = await ctx.signedIn('wsout@teste.com');
    const pc = await ctx.otherDevice(mac.user.id);
    await ctx.as(mac.token).put('/api/workspaces', { snapshot: snapshot('X') });
    await ctx.as(mac.token).post('/api/logout');
    expect((await ctx.as(pc.token).get('/api/workspaces')).body).toEqual({ computers: [] });
  });

  it('linha de antes do resumo ainda aparece na lista', async () => {
    const mac = await ctx.signedIn('wsold@teste.com');
    const pc = await ctx.otherDevice(mac.user.id);
    await ctx.as(mac.token).put('/api/workspaces', { snapshot: snapshot('Antigo') });
    await ctx.db.update(schema.deviceWorkspaces).set({ summary: null }).where(eq(schema.deviceWorkspaces.sessionId, mac.sessionId));
    const seen = await ctx.as(pc.token).get('/api/workspaces');
    expect(seen.body.computers[0].boards).toEqual([{ id: 'main', name: 'Antigo', folders: 1, groups: 0, notes: 0 }]);
  });

  it(`no máximo ${WORKSPACE_SENDS_PER_HOUR} envios por hora por pessoa, somando os computadores`, async () => {
    const mac = await ctx.signedIn('wslimit@teste.com');
    const pc = await ctx.otherDevice(mac.user.id);
    for (let i = 0; i < WORKSPACE_SENDS_PER_HOUR; i++) {
      const token = i % 2 ? pc.token : mac.token;
      expect((await ctx.as(token).put('/api/workspaces', { snapshot: snapshot(`V${i}`) })).status).toBe(204);
    }
    const over = await ctx.as(mac.token).put('/api/workspaces', { snapshot: snapshot('Demais') });
    expect(over.status).toBe(429);
    expect(Number(over.headers['retry-after'])).toBeGreaterThan(3000);
    // Outra pessoa não é afetada.
    const other = await ctx.signedIn('wslimit2@teste.com');
    expect((await ctx.as(other.token).put('/api/workspaces', { snapshot: snapshot('Livre') })).status).toBe(204);
  });

  it('recusa formato errado, sem login e grande demais', async () => {
    const { token } = await ctx.signedIn('wsbad@teste.com');
    expect((await ctx.as(token).put('/api/workspaces', { snapshot: { boards: 'x' } })).status).toBe(400);
    expect((await ctx.as(token).put('/api/workspaces', { snapshot: { boards: [{ id: 1, name: 'x', nodes: [] }] } })).status).toBe(400);
    expect((await ctx.as(null).get('/api/workspaces')).status).toBe(401);
    const big = { boards: [{ id: 'b', name: 'B', nodes: [{ text: 'x'.repeat(1_100_000) }] }] };
    expect((await ctx.as(token).put('/api/workspaces', { snapshot: big })).status).toBe(413);
  });
});
