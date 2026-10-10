import type { BrowserWindow, WebContents } from 'electron'
import type { CanvasViewport } from '../../shared/canvas'
import { PageMap } from './pages'

// O canvas pode estar aberto em várias janelas (uma por monitor), todas mostrando o mesmo canvas,
// cada uma com a própria câmera. Quem guarda o canvas é o CanvasHub; aqui ficam as janelas.
const canvasWindows = new Set<BrowserWindow>()
// Última janela do canvas em uso: é nela que entram o `argus .`, a conversa da notificação e as
// ações do assistente do canvas.
let lastCanvas: BrowserWindow | null = null
// Páginas do canvas montadas, prontas para receber o `argus .`. Recarregar a página derruba quem
// escuta; ela avisa de novo (cli:ready) quando o canvas montar.
const ready = new PageMap<true>()
// Câmera de cada janela (pelo id do webContents), guardada ao fechar o app.
const viewports = new Map<number, CanvasViewport>()

export function addCanvasWindow(win: BrowserWindow, viewport?: CanvasViewport | null): void {
  const id = win.webContents.id
  canvasWindows.add(win)
  lastCanvas = win
  if (viewport) viewports.set(id, viewport)
  win.on('focus', () => (lastCanvas = win))
  win.on('closed', () => {
    canvasWindows.delete(win)
    viewports.delete(id)
    if (lastCanvas === win) lastCanvas = null
  })
}

export function isCanvasWindow(win: BrowserWindow | null): boolean {
  return !!win && canvasWindows.has(win)
}

export function canvasWindowList(): BrowserWindow[] {
  return [...canvasWindows]
}

export function activeCanvas(): BrowserWindow | null {
  if (lastCanvas && !lastCanvas.isDestroyed()) return lastCanvas
  return canvasWindows.values().next().value ?? null
}

// A janela em uso, se o canvas dela já montou.
export function readyCanvas(): BrowserWindow | null {
  const win = activeCanvas()
  return win && ready.has(win.webContents) ? win : null
}

export function markCanvasReady(wc: WebContents): void {
  ready.set(wc, true)
}

export function isCanvasReady(wc: WebContents): boolean {
  return ready.has(wc)
}

export function windowViewport(wc: WebContents): CanvasViewport | null {
  return viewports.get(wc.id) ?? null
}

export function setWindowViewport(wc: WebContents, viewport: CanvasViewport): void {
  viewports.set(wc.id, viewport)
}
