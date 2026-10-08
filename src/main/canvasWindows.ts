import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, screen, type Rectangle } from 'electron'
import type { CanvasViewport } from '../shared/canvas'

// Janelas do canvas abertas ao fechar o app (uma por monitor, por exemplo): reabrem no mesmo
// lugar e cada uma olhando o mesmo pedaço do canvas.
export type SavedCanvasWindow = { bounds: Rectangle; maximized: boolean; viewport: CanvasViewport | null }

const file = () => join(app.getPath('userData'), 'windows.json')

export function loadCanvasWindows(): SavedCanvasWindow[] {
  try {
    const saved = JSON.parse(readFileSync(file(), 'utf8'))
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

export function saveCanvasWindows(windows: SavedCanvasWindow[]): void {
  try {
    writeFileSync(file(), JSON.stringify(windows))
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
