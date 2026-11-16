import { beforeEach, describe, expect, it } from 'vitest';
import type { RemoteHostInfo } from '@argus/shared/remote';
import type { CanvasNode } from '../types';
import type { Drawer } from './drawerState';
import { loadPinnedDrawers, savePinnedDrawers } from './savedDrawers';

// Drawer fixado sumia ao trocar de workspace, ao reabrir o app e, no acesso remoto, a cada vez que a
// ligação caía e voltava (a janela recarrega): a conversa ficava só na lista da pasta (2026-11-16).

const store = new Map<string, string>();
const globals = globalThis as Record<string, unknown>;
globals.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};
const api = (globals.window as { api: Record<string, unknown> }).api;
const setRemote = (host: RemoteHostInfo | null) => (api.remote = { host });

const node = (id: string) => ({ id, type: 'project', position: { x: 0, y: 0 }, data: {} }) as unknown as CanvasNode;
const rect = { x: 10, y: 20, width: 400, height: 600, area: { width: 1440, height: 900 } };
const drawer = (id: string, pinned: boolean, conversation: Drawer['conversation']): Drawer => ({ id, conversation, pinned, rect });

beforeEach(() => {
  store.clear();
  setRemote(null);
});

describe('drawers fixados guardados por workspace', () => {
  it('volta só o fixado, no mesmo lugar, e o solto fica de fora', () => {
    savePinnedDrawers('main', [
      drawer('d3', true, { nodeId: 'p1', conversationId: 's1', sessionId: 's1' }),
      drawer('d4', false, { nodeId: 'p1', conversationId: 's2' }),
    ]);
    const state = loadPinnedDrawers('main', [node('p1')]);
    expect(state.drawers).toEqual([{ id: 'd1', pinned: true, rect, conversation: { nodeId: 'p1', conversationId: 's1', sessionId: 's1' } }]);
    expect(state.nextId).toBe(2);
  });

  it('cada workspace tem os seus', () => {
    savePinnedDrawers('a', [drawer('d1', true, { nodeId: 'p1', conversationId: 's1' })]);
    expect(loadPinnedDrawers('b', [node('p1')]).drawers).toEqual([]);
  });

  it('pasta que saiu do canvas não traz o drawer dela', () => {
    savePinnedDrawers('main', [drawer('d1', true, { nodeId: 'gone', conversationId: 's1' })]);
    expect(loadPinnedDrawers('main', [node('p1')]).drawers).toEqual([]);
  });

  it('rascunho volta pela sessão; sem sessão, não volta', () => {
    savePinnedDrawers('main', [
      drawer('d1', true, { nodeId: 'p1', conversationId: 'new-1', draft: true, sessionId: 's9' }),
      drawer('d2', true, { nodeId: 'p1', conversationId: 'new-2', draft: true }),
    ]);
    expect(loadPinnedDrawers('main', [node('p1')]).drawers.map((d) => d.conversation)).toEqual([
      { nodeId: 'p1', conversationId: 's9', sessionId: 's9' },
    ]);
  });

  it('desafixar ou fechar o último apaga o guardado', () => {
    savePinnedDrawers('main', [drawer('d1', true, { nodeId: 'p1', conversationId: 's1' })]);
    savePinnedDrawers('main', [drawer('d1', false, { nodeId: 'p1', conversationId: 's1' })]);
    expect(store.size).toBe(0);
  });

  it('o acesso remoto guarda à parte do computador daqui, com o mesmo id de workspace', () => {
    savePinnedDrawers('main', [drawer('d1', true, { nodeId: 'p1', conversationId: 'aqui' })]);
    setRemote({ name: 'casa', platform: 'win32', homeDir: 'C:\\Users\\ana', windowsBuild: 26100, version: '1' });
    expect(loadPinnedDrawers('main', [node('p1')]).drawers).toEqual([]);
    savePinnedDrawers('main', [drawer('d1', true, { nodeId: 'p1', conversationId: 'la' })]);
    expect(loadPinnedDrawers('main', [node('p1')]).drawers[0].conversation.conversationId).toBe('la');
  });

  it('guardado estragado não quebra a abertura', () => {
    store.set('argus.pinnedDrawers:main', '{não é json');
    expect(loadPinnedDrawers('main', [node('p1')]).drawers).toEqual([]);
  });
});
