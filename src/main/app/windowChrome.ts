import { BrowserWindow, nativeTheme } from 'electron'
import { IS_MAC } from '../platform'

// Moldura das janelas: barra de título própria, os botões do sistema na cor dela e os atalhos que,
// sem menu, o Windows não teria.

// Altura da barra de título do app (TITLE_BAR_HEIGHT, em conversation/panelGeometry.ts).
const TITLE_BAR_HEIGHT = 40

export type WindowKind = 'canvas' | 'conversation'
const windowKinds = new WeakMap<BrowserWindow, WindowKind>()

// Sem a barra do sistema. No Mac, os semáforos ficam dentro da barra do app. No Windows,
// minimizar, maximizar e fechar são desenhados pelo sistema por cima da barra do app, na cor dela:
// a barra de título do canvas (surface) ou o cabeçalho da conversa (bg), como no index.css.
export function frame(kind: WindowKind): Electron.BrowserWindowConstructorOptions {
  if (IS_MAC) return { titleBarStyle: 'hiddenInset' }
  return { titleBarStyle: 'hidden', titleBarOverlay: overlay(kind) }
}

function overlay(kind: WindowKind): Electron.TitleBarOverlay {
  const dark = nativeTheme.shouldUseDarkColors
  const color = kind === 'canvas' ? (dark ? '#282828' : '#ffffff') : dark ? '#1c1c1c' : '#ececec'
  return { color, symbolColor: dark ? '#a5a5a5' : '#6e6e73', height: TITLE_BAR_HEIGHT }
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
    if (kind && !win.isDestroyed()) win.setTitleBarOverlay(overlay(kind))
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
