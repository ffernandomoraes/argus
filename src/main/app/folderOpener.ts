import { app, BrowserWindow, type WebContents } from 'electron'
import { openArg, validFolder } from '../cli'
import { sendTo } from '../ipc/events'
import { IS_MAC } from '../platform'
import { isCanvasWindow, markCanvasReady, readyCanvas } from './canvasRegistry'
import { showApp } from './windows'

// `argus .` num terminal: traz o app para frente e manda a pasta para o canvas. Com o app ainda
// abrindo, a pasta espera o canvas avisar que está pronto.
const pendingOpens: string[] = []

export function openFolder(path: string): void {
  showApp()
  const win = readyCanvas()
  if (win) sendTo(win.webContents, 'cli:open', path)
  else pendingOpens.push(path)
}

// O canvas de uma janela montou (cli:ready): passa a receber as pastas, e recebe as que esperavam.
export function canvasMounted(wc: WebContents): void {
  if (!isCanvasWindow(BrowserWindow.fromWebContents(wc))) return
  markCanvasReady(wc)
  for (const path of pendingOpens.splice(0)) sendTo(wc, 'cli:open', path)
}

// Windows: o argus.cmd abre o Argus.exe com a pasta. Com o app fechado, ela vem na abertura; com
// ele aberto, a segunda instância entrega a pasta a esta e sai. No Mac, uma segunda cópia aberta
// (`open -n`) só traz esta para frente.
export function receiveFolders(): void {
  const startFolder = !IS_MAC && validFolder(openArg(process.argv))
  if (startFolder) pendingOpens.push(startFolder)
  app.on('second-instance', (_e, argv, _cwd, data) => {
    const path = validFolder((data as { open?: string | null } | undefined)?.open ?? openArg(argv))
    if (path) openFolder(path)
    else showApp()
  })
}
