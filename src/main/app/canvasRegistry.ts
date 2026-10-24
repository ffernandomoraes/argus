import type { BrowserWindow, WebContents } from 'electron'
import type { CanvasViewport } from '../../shared/canvas'
import { PageMap } from './pages'

// O canvas pode estar aberto em várias janelas (uma por monitor), cada uma no workspace dela e com
// a própria câmera em cada workspace. Quem guarda os canvas são os CanvasHub (ver boards.ts); aqui
// ficam as janelas.
const canvasWindows = new Set<BrowserWindow>()
// Última janela do canvas em uso: é nela que entram o `argus .`, a conversa da notificação e as
// ações do assistente do canvas.
let lastCanvas: BrowserWindow | null = null
// Páginas do canvas montadas, prontas para receber o `argus .`. Recarregar a página derruba quem
// escuta; ela avisa de novo (cli:ready) quando o canvas montar.
const ready = new PageMap<true>()
// Câmera de cada janela (pelo id do webContents) em cada workspace; a do workspace aberto é
// guardada ao fechar o app.
const viewports = new Map<number, Map<string, CanvasViewport>>()
// Workspace que cada janela mostra. Sem ele, o primeiro (quem lê confere se ainda existe).
const shownBoards = new Map<number, string>()

export function addCanvasWindow(win: BrowserWindow, board?: string, viewport?: CanvasViewport | null): void {
  const id = win.webContents.id
  canvasWindows.add(win)
  // Janela nova sem workspace guardado (⇧⌘N): abre no da janela em uso.
  const shown = board ?? (lastCanvas && !lastCanvas.isDestroyed() ? shownBoards.get(lastCanvas.webContents.id) : undefined)
  lastCanvas = win
  if (shown) {
    shownBoards.set(id, shown)
    if (viewport) viewports.set(id, new Map([[shown, viewport]]))
  }
  win.on('focus', () => (lastCanvas = win))
  win.on('closed', () => {
    canvasWindows.delete(win)
    viewports.delete(id)
    shownBoards.delete(id)
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

export function windowBoard(wc: WebContents): string | undefined {
  return shownBoards.get(wc.id)
}

export function setWindowBoard(wc: WebContents, board: string): void {
  shownBoards.set(wc.id, board)
}

// Sem workspace, o que a janela mostra agora (para guardar ao fechar o app).
export function windowViewport(wc: WebContents, board = shownBoards.get(wc.id)): CanvasViewport | null {
  return (board && viewports.get(wc.id)?.get(board)) || null
}

export function setWindowViewport(wc: WebContents, board: string, viewport: CanvasViewport): void {
  const byBoard = viewports.get(wc.id) ?? new Map<string, CanvasViewport>()
  byBoard.set(board, viewport)
  viewports.set(wc.id, byBoard)
}
