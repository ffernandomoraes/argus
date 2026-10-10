import { app } from 'electron'
import { cleanupAccounts } from '../accounts'
import { loadAppSettings } from '../appSettings'
import { registerIpc } from '../ipc'
import { runSmokeTest, SMOKE_TEST } from '../smokeTest'
import { watchAppearance } from './appearance'
import { activeCanvas, canvasWindowList, isCanvasReady } from './canvasRegistry'
import { checkForUpdates } from './checkForUpdates'
import type { Lifecycle } from './lifecycle'
import { setAppMenu } from './menu'
import { setupPermissions } from './permissions'
import type { Services } from './services'
import { step } from './step'
import { createCanvasWindow, restoreCanvasWindows } from './windows'

// Abertura, com o app pronto. Cada etapa é protegida (ver step.ts): uma que falha fica no console
// e não impede a janela de abrir.
export function startApp(s: Services, life: Lifecycle): void {
  step('menu', () => setAppMenu(() => checkForUpdates(s.updater, life.restartToUpdate)))
  step('permissões', setupPermissions)
  step('canais da janela', () => registerIpc(s, life))
  step('tema e cor de destaque', watchAppearance)
  // Os monitores de uso sobem quando o login de cada conta é conferido.
  step('limpar contas', cleanupAccounts)
  step('conferir o login', () => s.auth.refresh())
  step('comando argus', () => s.cli.start())
  step('atualizações', () => s.updater.start())
  step('ícone da barra de menus', () => s.tray.set(loadAppSettings().menuBarIcon))
  app.on('browser-window-focus', () => s.tray.seen())
  step('janelas do canvas', restoreCanvasWindows)
  const firstCanvas = activeCanvas()
  if (SMOKE_TEST && firstCanvas) {
    // Sai pelo mesmo caminho de quem fecha a janela, já confirmado.
    runSmokeTest(firstCanvas, s.terminals, () => isCanvasReady(firstCanvas.webContents), life.confirmAndQuit)
  }
  // Mac: o Dock traz o canvas de volta quando nenhuma janela dele está aberta, mesmo com uma
  // conversa aberta em janela separada.
  app.on('activate', () => {
    if (!canvasWindowList().length) createCanvasWindow()
  })
}
