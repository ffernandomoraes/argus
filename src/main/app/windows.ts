import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { loadCanvasWindows, saveCanvasWindows, type SavedCanvasWindow } from '../canvasWindows'
import { IS_MAC } from '../platform'
import { rendererEntry } from './appUrl'
import { activeCanvas, addCanvasWindow, canvasWindowList, windowViewport } from './canvasRegistry'
import { placeCanvas } from './canvasPlacement'
import { lockNavigation, openLinksOutside } from './navigation'
import { frame, setWindowKind, windowShortcuts, type WindowKind } from './windowChrome'

// Criar as janelas do app (canvas e conversa avulsa), trazer o app para frente e guardar onde as
// janelas do canvas estavam.

// Sandbox ainda desligado: o preload já roda sem módulos do Node (só o electron), mas ligar fica
// para depois de conferir o app montado.
const webPreferences = { preload: join(__dirname, '../preload/index.js'), sandbox: false }

function loadRenderer(win: BrowserWindow, hash = ''): void {
  const entry = rendererEntry()
  const loading =
    'dev' in entry
      ? win.loadURL(entry.dev + (hash ? `#${hash}` : ''))
      : win.loadFile(entry.file, hash ? { hash } : undefined)
  loading.catch((err: unknown) => console.error('[janela] a interface não carregou:', err))
}

// O que toda janela do app tem: a moldura do tipo dela, as travas de navegação e os atalhos.
function prepare(win: BrowserWindow, kind: WindowKind, hash?: string): void {
  setWindowKind(win, kind)
  lockNavigation(win.webContents)
  openLinksOutside(win.webContents)
  windowShortcuts(win)
  loadRenderer(win, hash)
}

export function createCanvasWindow(saved?: SavedCanvasWindow): BrowserWindow {
  const place = placeCanvas(saved)
  const win = new BrowserWindow({
    ...place.bounds,
    minWidth: 900,
    minHeight: 600,
    ...frame('canvas'),
    backgroundColor: '#1c1c1c',
    webPreferences
  })
  addCanvasWindow(win, saved?.viewport)
  if (place.maximize) win.maximize()
  prepare(win, 'canvas')
  return win
}

// Janela de uma conversa só, para levar a outro monitor.
export function createConversationWindow(hash: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 640,
    height: 860,
    minWidth: 420,
    minHeight: 480,
    ...frame('conversation'),
    backgroundColor: '#1c1c1c',
    webPreferences
  })
  prepare(win, 'conversation', hash)
  return win
}

// Ao abrir o app: as janelas do canvas como estavam ao fechar; sem nada guardado, uma só.
export function restoreCanvasWindows(): void {
  const saved = loadCanvasWindows()
  if (!saved.length) return void createCanvasWindow()
  for (const w of saved) createCanvasWindow(w)
}

// Ao fechar o app; a janela em uso vai por último, para voltar na frente.
export function saveCanvasWindowLayout(): void {
  const active = activeCanvas()
  const open = canvasWindowList().filter((w) => !w.isDestroyed())
  const ordered = [...open.filter((w) => w !== active), ...open.filter((w) => w === active)]
  saveCanvasWindows(
    ordered.map((w) => ({
      bounds: w.getNormalBounds(),
      maximized: w.isMaximized(),
      viewport: windowViewport(w.webContents)
    }))
  )
}

// Traz o canvas para frente (ou abre de novo, se as janelas foram fechadas).
export function showApp(): void {
  const win = activeCanvas()
  if (!win) return void createCanvasWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  // No Windows o foco não vem junto (o "steal" é só do Mac).
  if (!IS_MAC) win.focus()
  app.focus({ steal: true })
}
