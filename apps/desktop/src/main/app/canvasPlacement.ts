import { screen } from 'electron'
import { onScreen, type SavedCanvasWindow } from '../canvasWindows'
import { activeCanvas, canvasWindowList } from './canvasRegistry'

export type CanvasPlace = { bounds: Electron.Rectangle; maximize: boolean }

// Onde abre uma janela do canvas: no lugar guardado, se o monitor dele ainda estiver ligado.
export function placeCanvas(saved?: SavedCanvasWindow): CanvasPlace {
  return saved && onScreen(saved.bounds) ? { bounds: saved.bounds, maximize: saved.maximized } : newCanvasBounds()
}

// Janela nova sem lugar guardado: ocupa a tela toda (sem cobrir menu e dock) de um monitor que
// ainda não tem canvas, começando pelo principal. Com todos ocupados, abre menor por cima da
// janela em uso, para se ver que é outra.
function newCanvasBounds(): CanvasPlace {
  const used = new Set(canvasWindowList().map((w) => screen.getDisplayMatching(w.getBounds()).id))
  const primary = screen.getPrimaryDisplay()
  const displays = [primary, ...screen.getAllDisplays().filter((d) => d.id !== primary.id)]
  const free = displays.find((d) => !used.has(d.id))
  if (free) return { bounds: free.workArea, maximize: true }
  const current = activeCanvas()
  const { workArea: a } = current ? screen.getDisplayMatching(current.getBounds()) : primary
  const inset = Math.round(Math.min(a.width, a.height) * 0.08)
  return { bounds: { x: a.x + inset, y: a.y + inset, width: a.width - inset * 2, height: a.height - inset * 2 }, maximize: false }
}
