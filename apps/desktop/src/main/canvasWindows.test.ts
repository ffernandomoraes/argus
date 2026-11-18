import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ao reabrir o app, só a câmera do workspace aberto voltava: trocar para outro enquadrava tudo de
// novo, perdendo posição e zoom (2026-11-17). Agora vai a de cada workspace visitado.

const saved = vi.hoisted(() => ({ data: [] as unknown }));
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' }, screen: {} }));
vi.mock('./lib/jsonFile', () => ({
  readJsonFile: () => ({ status: 'ok', data: saved.data }),
  writeJsonAtomicSync: () => {},
}));

const { loadCanvasWindows } = await import('./canvasWindows');

const bounds = { x: 0, y: 0, width: 1200, height: 800 };

beforeEach(() => {
  saved.data = [];
});

describe('janelas do canvas guardadas', () => {
  it('traz a câmera de cada workspace e ignora a estragada', () => {
    saved.data = [
      {
        bounds,
        maximized: false,
        board: 'a',
        viewport: { x: 1, y: 2, zoom: 0.5 },
        viewports: { a: { x: 1, y: 2, zoom: 0.5 }, b: { x: 3, y: 4, zoom: 1.5 }, c: { x: 'x' } },
      },
    ];
    expect(loadCanvasWindows()[0].viewports).toEqual({ a: { x: 1, y: 2, zoom: 0.5 }, b: { x: 3, y: 4, zoom: 1.5 } });
  });

  it('arquivo de versão antiga (sem viewports) continua abrindo', () => {
    saved.data = [{ bounds, maximized: true, board: 'a', viewport: { x: 1, y: 2, zoom: 1 } }];
    const [win] = loadCanvasWindows();
    expect(win.viewport).toEqual({ x: 1, y: 2, zoom: 1 });
    expect(win.viewports).toEqual({});
  });
});
