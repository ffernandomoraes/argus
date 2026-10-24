import { join } from 'node:path'
import { app, BrowserWindow, screen } from 'electron'
import { loadCanvasWindows, saveCanvasWindows, type SavedCanvasWindow } from '../canvasWindows'
import { IS_MAC } from '../platform'
import { rendererEntry } from './appUrl'
import { activeCanvas, addCanvasWindow, canvasWindowList, windowBoard, windowViewport } from './canvasRegistry'
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

// A última janela do canvas fechada (Mac: o app segue no Dock). Volta no mesmo lugar ao clicar no
// Dock e é a que fica guardada se o app fechar sem nenhuma aberta.
let lastClosed: SavedCanvasWindow | null = null

// Onde a janela está. Maximizada, o Electron devolve o lugar de antes de maximizar, que pode ser
// outro monitor (a janela abriu maximizada no principal e foi levada para outro): aí vale o atual.
function placementOf(win: BrowserWindow): SavedCanvasWindow {
  const maximized = win.isMaximized()
  const normal = win.getNormalBounds()
  const current = win.getBounds()
  const sameDisplay = screen.getDisplayMatching(normal).id === screen.getDisplayMatching(current).id
  const board = windowBoard(win.webContents)
  return { bounds: maximized && !sameDisplay ? current : normal, maximized, ...(board && { board }), viewport: windowViewport(win.webContents) }
}

export function createCanvasWindow(saved?: SavedCanvasWindow): BrowserWindow {
  // Sem lugar guardado e sem outra janela aberta (clique no Dock): volta onde a última fechou.
  const where = saved ?? (canvasWindowList().length ? undefined : (lastClosed ?? undefined))
  const place = placeCanvas(where)
  const win = new BrowserWindow({
    ...place.bounds,
    minWidth: 900,
    minHeight: 600,
    ...frame('canvas'),
    backgroundColor: '#1c1c1c',
    webPreferences
  })
  addCanvasWindow(win, where?.board, where?.viewport)
  lastClosed = null
  if (place.maximize) win.maximize()
  win.on('close', () => {
    if (canvasWindowList().length === 1) lastClosed = placementOf(win)
  })
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

// Mascote solto na tela: janela transparente, sem moldura nem sombra, por cima de todos os apps e
// em todas as mesas (inclusive as de app em tela cheia, no Mac), fora da barra de tarefas e sem
// nunca pegar o foco. O clique atravessa (vai para o app de baixo) até o ponteiro entrar no boneco
// (ver MascotOverlay). No Mac é um painel: é o tipo de janela que fica por cima das telas cheias.
export function createMascotWindow(bounds: Electron.Rectangle): BrowserWindow {
  const win = new BrowserWindow({
    ...bounds,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    hasShadow: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    // Windows e Linux: nunca pega o foco (o clique não ativa o Argus). No Mac fica com as opções
    // padrão: o painel já não ativa o app, e com focusable: false e acceptFirstMouse o clique no
    // boneco ativava o Argus e trazia as janelas dele para a frente (experimento de 2026-10-22).
    ...(IS_MAC ? {} : { focusable: false }),
    show: false,
    ...(IS_MAC ? { type: 'panel' } : {}),
    webPreferences
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  // skipTransformProcessType: sem ele, no Mac, o ícone do Dock some e volta a cada chamada.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true })
  lockNavigation(win.webContents)
  openLinksOutside(win.webContents)
  loadRenderer(win, 'mascot')
  win.once('ready-to-show', () => win.showInactive())
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
  saveCanvasWindows(ordered.length ? ordered.map(placementOf) : lastClosed ? [lastClosed] : [])
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
