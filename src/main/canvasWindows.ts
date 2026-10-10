import { join } from 'node:path'
import { app, screen, type Rectangle } from 'electron'
import type { CanvasViewport } from '../shared/canvas'
import { readJsonFile, writeJsonAtomicSync } from './lib/jsonFile'

// Janelas do canvas abertas ao fechar o app (uma por monitor, por exemplo): reabrem no mesmo
// lugar e cada uma olhando o mesmo pedaço do canvas.
export type SavedCanvasWindow = { bounds: Rectangle; maximized: boolean; viewport: CanvasViewport | null }

const file = () => join(app.getPath('userData'), 'windows.json')

const numbers = (o: unknown, keys: string[]) =>
  !!o && typeof o === 'object' && keys.every((k) => Number.isFinite((o as Record<string, unknown>)[k]))

// Arquivo de outra versão ou editado à mão: janela sem posição válida fica de fora (abriria
// fora da tela ou derrubaria a abertura do app).
function parse(w: unknown): SavedCanvasWindow | null {
  const { bounds, maximized, viewport } = (w ?? {}) as Partial<SavedCanvasWindow>
  if (!bounds || !numbers(bounds, ['x', 'y', 'width', 'height'])) return null
  return {
    bounds,
    maximized: maximized === true,
    viewport: viewport && numbers(viewport, ['x', 'y', 'zoom']) ? viewport : null
  }
}

export function loadCanvasWindows(): SavedCanvasWindow[] {
  const r = readJsonFile<unknown>(file())
  if (r.status !== 'ok' || !Array.isArray(r.data)) return []
  return r.data.map(parse).filter((w): w is SavedCanvasWindow => w !== null)
}

// Atômico: fechar o app no meio da gravação não deixa o arquivo pela metade.
export function saveCanvasWindows(windows: SavedCanvasWindow[]): void {
  try {
    writeJsonAtomicSync(file(), windows)
  } catch {
    // Sem gravar, o app abre com uma janela só.
  }
}

// Monitor desconectado desde a última vez: a janela guardada cairia fora da tela.
export function onScreen(bounds: Rectangle): boolean {
  return screen.getAllDisplays().some(({ workArea: a }) => {
    const w = Math.min(a.x + a.width, bounds.x + bounds.width) - Math.max(a.x, bounds.x)
    const h = Math.min(a.y + a.height, bounds.y + bounds.height) - Math.max(a.y, bounds.y)
    return w >= 100 && h >= 100
  })
}
