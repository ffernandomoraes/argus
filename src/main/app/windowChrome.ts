import { BrowserWindow, nativeTheme } from 'electron'
import { IS_MAC } from '../platform'
import { linuxIcon } from './linuxDesktop'

// Moldura das janelas: barra de título própria, os botões do sistema na cor dela e os atalhos que,
// sem menu, o Windows não teria.

// Altura da barra de título do canvas (TITLE_BAR_HEIGHT, em conversation/panelGeometry.ts). A janela
// da conversa segue com a altura de antes, a do cabeçalho dela.
const TITLE_BAR_HEIGHT = { canvas: 34, conversation: 40 }

// Semáforos do Mac na janela do canvas, no meio da barra de título.
const CANVAS_TRAFFIC_LIGHTS = { x: 16, y: 11 }

export type WindowKind = 'canvas' | 'conversation'
const windowKinds = new WeakMap<BrowserWindow, WindowKind>()
// Tamanho da interface de cada janela (ver setInterfaceZoom); sem registro, 1.
const windowZooms = new WeakMap<BrowserWindow, number>()

// Sem a barra do sistema. No Mac, os semáforos ficam dentro da barra do app. No Windows,
// minimizar, maximizar e fechar são desenhados pelo sistema por cima da barra do app, na cor dela:
// a barra de título do canvas (surface) ou o cabeçalho da conversa (bg), como no index.css.
// No Linux a janela recebe também o ícone do app (a barra de tarefas não o pega do executável).
export function frame(kind: WindowKind): Electron.BrowserWindowConstructorOptions {
  // Na do canvas, os semáforos descem para o meio da barra (mais baixa que a padrão do hiddenInset).
  // A da conversa tem cabeçalho próprio, alinhado com a posição padrão.
  if (IS_MAC) return kind === 'canvas' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: CANVAS_TRAFFIC_LIGHTS } : { titleBarStyle: 'hiddenInset' }
  const icon = linuxIcon()
  return { titleBarStyle: 'hidden', titleBarOverlay: overlay(kind), ...(icon ? { icon } : {}) }
}

// zoom: a barra de título cresce com o tamanho da interface, e os botões do Windows acompanham.
function overlay(kind: WindowKind, zoom = 1): Electron.TitleBarOverlay {
  const dark = nativeTheme.shouldUseDarkColors
  const color = kind === 'canvas' ? (dark ? '#282828' : '#ffffff') : dark ? '#1c1c1c' : '#ececec'
  return { color, symbolColor: dark ? '#a5a5a5' : '#6e6e73', height: Math.round(TITLE_BAR_HEIGHT[kind] * zoom) }
}

// Tamanho da interface (Configurações > Aparência): a página inteira cresce e os botões do sistema
// seguem no meio da barra de título, que cresce junto. A janela da conversa só tem o recuo ajustado
// (os semáforos dela já não acompanham o zoom do drawer, que muda a altura do cabeçalho).
export function setInterfaceZoom(win: BrowserWindow, zoom: number): void {
  win.webContents.setZoomFactor(zoom)
  windowZooms.set(win, zoom)
  const kind = windowKinds.get(win)
  if (!kind) return
  if (!IS_MAC) return win.setTitleBarOverlay(overlay(kind, zoom))
  if (kind === 'canvas') {
    const { x, y } = CANVAS_TRAFFIC_LIGHTS
    win.setWindowButtonPosition({ x, y: Math.round(y + (TITLE_BAR_HEIGHT.canvas * (zoom - 1)) / 2) })
  }
}

// Guarda o tipo da janela para pintar os botões do Windows de novo quando o tema trocar.
export function setWindowKind(win: BrowserWindow, kind: WindowKind): void {
  windowKinds.set(win, kind)
}

// Tema trocado, no app ou no sistema: os botões do Windows acompanham.
export function repaintOverlays(): void {
  if (IS_MAC) return
  for (const win of BrowserWindow.getAllWindows()) {
    const kind = windowKinds.get(win)
    if (kind && !win.isDestroyed()) win.setTitleBarOverlay(overlay(kind, windowZooms.get(win)))
  }
}

// Windows: sem o menu Ver, o F12 (ou Ctrl+Shift+I) abre as ferramentas de desenvolvedor e o F11
// põe em tela cheia.
export function windowShortcuts(win: BrowserWindow): void {
  if (IS_MAC) return
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      e.preventDefault()
      win.webContents.toggleDevTools()
    } else if (input.key === 'F11') {
      e.preventDefault()
      win.setFullScreen(!win.isFullScreen())
    }
  })
}
