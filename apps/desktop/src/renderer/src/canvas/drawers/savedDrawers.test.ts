import { beforeEach, describe, expect, it } from 'vitest';
import type { RemoteHostInfo } from '@argus/shared/remote';
import type { CanvasNode } from '../types';
import type { Drawer } from './drawerState';
import { loadBoardDrawers, saveBoardDrawers } from './savedDrawers';

// Drawer fixado sumia ao trocar de workspace, ao reabrir o app e, no acesso remoto, a cada vez que a
// ligação caía e voltava (a janela recarrega): a conversa ficava só na lista da pasta (2026-11-16).
// O solto também sumia ao trocar de workspace e voltar, e ao reiniciar para atualizar (2026-11-17).

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

describe('drawers guardados por workspace', () => {
  it('guardado por versão antiga (sem pinned) volta como fixado, no mesmo lugar', () => {
    const conversation = { nodeId: 'p1', conversationId: 's1', sessionId: 's1' };
    store.set('argus.pinnedDrawers:main', JSON.stringify([{ conversation, rect }]));
    const state = loadBoardDrawers('main', [node('p1')]);
    expect(state.drawers).toEqual([{ id: 'd1', pinned: true, rect, conversation }]);
    expect(state.nextId).toBe(2);
  });

  it('o solto volta por cima dos fixados (troca de workspace, app reaberto ou atualizado)', () => {
    saveBoardDrawers('main', [
      drawer('d3', true, { nodeId: 'p1', conversationId: 's1' }),
      drawer('d4', false, { nodeId: 'p1', conversationId: 's2' }),
    ]);
    const state = loadBoardDrawers('main', [node('p1')]);
    expect(state.drawers.map((d) => [d.id, d.pinned, d.conversation.conversationId])).toEqual([
      ['d1', true, 's1'],
      ['d2', false, 's2'],
    ]);
    expect(state.nextId).toBe(3);
  });

  it('fechar o solto esquece ele; solto de pasta que saiu do canvas não volta', () => {
    saveBoardDrawers('main', [drawer('d1', false, { nodeId: 'p1', conversationId: 's1' })]);
    saveBoardDrawers('main', []);
    expect(loadBoardDrawers('main', [node('p1')]).drawers).toEqual([]);
    saveBoardDrawers('main', [drawer('d1', false, { nodeId: 'gone', conversationId: 's1' })]);
    expect(loadBoardDrawers('main', [node('p1')]).drawers).toEqual([]);
  });

  it('cada workspace tem os seus', () => {
    saveBoardDrawers('a', [drawer('d1', true, { nodeId: 'p1', conversationId: 's1' })]);
    saveBoardDrawers('a', [drawer('d2', false, { nodeId: 'p1', conversationId: 's2' })]);
    expect(loadBoardDrawers('b', [node('p1')]).drawers).toEqual([]);
  });

  it('pasta que saiu do canvas não traz o drawer dela', () => {
    saveBoardDrawers('main', [drawer('d1', true, { nodeId: 'gone', conversationId: 's1' })]);
    expect(loadBoardDrawers('main', [node('p1')]).drawers).toEqual([]);
  });

  it('rascunho volta pela sessão; sem sessão, não volta', () => {
    saveBoardDrawers('main', [
      drawer('d1', true, { nodeId: 'p1', conversationId: 'new-1', draft: true, sessionId: 's9' }),
      drawer('d2', true, { nodeId: 'p1', conversationId: 'new-2', draft: true }),
    ]);
    expect(loadBoardDrawers('main', [node('p1')]).drawers.map((d) => d.conversation)).toEqual([
      { nodeId: 'p1', conversationId: 's9', sessionId: 's9' },
    ]);
  });

  it('fechar o último apaga o guardado', () => {
    saveBoardDrawers('main', [drawer('d1', true, { nodeId: 'p1', conversationId: 's1' })]);
    saveBoardDrawers('main', []);
    expect(store.size).toBe(0);
  });

  it('o acesso remoto guarda à parte do computador daqui, com o mesmo id de workspace', () => {
    saveBoardDrawers('main', [drawer('d1', true, { nodeId: 'p1', conversationId: 'aqui' })]);
    setRemote({ name: 'casa', platform: 'win32', homeDir: 'C:\\Users\\ana', windowsBuild: 26100, version: '1' });
    expect(loadBoardDrawers('main', [node('p1')]).drawers).toEqual([]);
    saveBoardDrawers('main', [drawer('d1', true, { nodeId: 'p1', conversationId: 'la' })]);
    expect(loadBoardDrawers('main', [node('p1')]).drawers[0].conversation.conversationId).toBe('la');
  });

  it('guardado estragado não quebra a abertura', () => {
    store.set('argus.pinnedDrawers:main', '{não é json');
    expect(loadBoardDrawers('main', [node('p1')]).drawers).toEqual([]);
  });
});
