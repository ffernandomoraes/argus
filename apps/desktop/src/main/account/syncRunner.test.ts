import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyMemory, type MainSyncValues, type RendererSyncValues } from '@argus/shared/accountSync';
import { SyncRunner } from './syncRunner';

// Dois computadores na mesma conta, com um servidor de mentira em memória (o de verdade está em
// apps/account): a primeira entrada, mudanças que vão e voltam e o conflito.

function fakeServer() {
  const items = new Map<string, { value: unknown; version: number }>();
  let version = 0;
  const fetchFn = async (url: string, init?: RequestInit): Promise<Response> => {
    const u = new URL(url);
    if (u.pathname !== '/api/sync') return new Response('', { status: 404 });
    if ((init?.method ?? 'GET') === 'GET') {
      const since = Number(u.searchParams.get('since'));
      const list = [...items].filter(([, v]) => v.version > since).map(([key, v]) => ({ key, value: v.value }));
      return Response.json({ items: list, version });
    }
    const body = JSON.parse(String(init?.body)) as { items: Record<string, unknown> };
    version++;
    for (const [key, value] of Object.entries(body.items)) items.set(key, { value, version });
    return Response.json({ version });
  };
  return { items, fetchFn };
}

// Um computador: as preferências do processo principal num objeto e as da janela em outro. A janela
// aplica o que chega e conta de novo, como o usePrefsSync.
function machine(main: MainSyncValues, renderer: RendererSyncValues) {
  const m = { main: { ...main }, renderer: { ...renderer }, applied: [] as RendererSyncValues[] };
  const runner: SyncRunner = new SyncRunner(emptyMemory(), {
    token: () => 'token',
    readMain: () => m.main,
    applyMain: (values) => Object.assign(m.main, values),
    applyRenderer: (values) => {
      m.applied.push(values);
      Object.assign(m.renderer, values);
      runner.report(m.renderer, true);
    },
    saveMemory: () => {},
  });
  runner.report(m.renderer, false);
  return { ...m, runner, state: m };
}

const MAIN_A: MainSyncValues = { language: 'pt', notifications: true, notificationSound: true, menuBarIcon: false, storage: { conversationDays: 90, scratchDays: 7, mediaDays: 60 } };
const RENDERER_A: RendererSyncValues = { theme: 'dark', mediaPlayer: true, openIn: 'panel' };

describe('SyncRunner', () => {
  let server: ReturnType<typeof fakeServer>;

  beforeEach(() => {
    server = fakeServer();
    process.env.ARGUS_ACCOUNT_URL = 'https://account.test';
    vi.stubGlobal('fetch', server.fetchFn);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ARGUS_ACCOUNT_URL;
  });

  it('o primeiro computador manda as dele; o segundo traz as da conta', async () => {
    const a = machine(MAIN_A, RENDERER_A);
    expect(await a.runner.adopt()).toBe('uploaded');
    expect(server.items.get('pref.theme')?.value).toBe('dark');
    expect(server.items.get('pref.language')?.value).toBe('pt');

    const b = machine({ ...MAIN_A, language: 'en', notifications: false }, { theme: 'light', mediaPlayer: false, openIn: 'window' });
    expect(await b.runner.adopt()).toBe('adopted');
    expect(b.state.main.language).toBe('pt');
    expect(b.state.main.notifications).toBe(true);
    expect(b.state.renderer).toEqual(RENDERER_A);
    // Nada daqui passou por cima da conta.
    expect(server.items.get('pref.theme')?.value).toBe('dark');
    expect(b.runner.hasPending).toBe(false);
  });

  it('o que a conta ainda não tem vai do segundo computador', async () => {
    const a = machine(MAIN_A, { theme: 'dark' });
    await a.runner.adopt();
    const b = machine(MAIN_A, { theme: 'light', pinNewDrawers: true });
    await b.runner.adopt();
    expect(b.state.renderer.theme).toBe('dark');
    expect(server.items.get('pref.pinNewDrawers')?.value).toBe(true);
  });

  it('mudança num computador chega no outro', async () => {
    const a = machine(MAIN_A, RENDERER_A);
    await a.runner.adopt();
    const b = machine(MAIN_A, RENDERER_A);
    await b.runner.adopt();

    a.state.renderer.theme = 'light';
    a.runner.report(a.state.renderer, true);
    a.state.main.language = 'en';
    a.runner.mainChanged();
    await a.runner.run();

    await b.runner.run();
    expect(b.state.renderer.theme).toBe('light');
    expect(b.state.main.language).toBe('en');
    // B aplicou e contou de volta sem virar pendente (não manda de volta o que recebeu).
    expect(b.runner.hasPending).toBe(false);
  });

  it('a mudada aqui e ainda não enviada vence a que chegou antes', async () => {
    const a = machine(MAIN_A, RENDERER_A);
    await a.runner.adopt();
    const b = machine(MAIN_A, RENDERER_A);
    await b.runner.adopt();

    a.state.main.language = 'en';
    a.runner.mainChanged();
    await a.runner.run();

    b.state.main.language = 'system';
    b.runner.mainChanged();
    await b.runner.run();
    expect(b.state.main.language).toBe('system');
    expect(server.items.get('pref.language')?.value).toBe('system');

    await a.runner.run();
    expect(a.state.main.language).toBe('system');
  });

  it('valor que chegou com a janela fechada vai quando ela conta as dela', async () => {
    const a = machine(MAIN_A, RENDERER_A);
    await a.runner.adopt();
    const b = machine(MAIN_A, RENDERER_A);
    await b.runner.adopt();

    a.state.renderer.mediaPlayer = false;
    a.runner.report(a.state.renderer, true);
    await a.runner.run();

    // Janela de B fechada: o que chega fica guardado.
    const sent: RendererSyncValues[] = [];
    const closed = new SyncRunner(emptyMemory(), {
      token: () => 'token',
      readMain: () => b.state.main,
      applyMain: () => {},
      applyRenderer: (values) => sent.push(values),
      saveMemory: () => {},
    });
    closed.report(RENDERER_A, false);
    await closed.adopt();
    sent.length = 0;
    // A janela abre e conta o que tinha: recebe o valor da conta em vez de mandá-lo de volta.
    closed.report(RENDERER_A, true);
    expect(sent).toEqual([{ mediaPlayer: false }]);
    expect(closed.hasPending).toBe(false);
  });
});
