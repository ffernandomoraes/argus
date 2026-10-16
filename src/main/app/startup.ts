import { app } from 'electron'
import { cleanupAccounts } from '../accounts'
import { registerIpc } from '../ipc'
import { IS_LINUX, IS_WIN } from '../platform'
import { warmUp } from '../wsl'
import { runSmokeTest, SMOKE_TEST } from '../smokeTest'
import { watchAppearance } from './appearance'
import { activeCanvas, canvasWindowList, isCanvasReady } from './canvasRegistry'
import { checkForUpdates } from './checkForUpdates'
import { watchOpening } from './crashGuard'
import { installDesktopEntry } from './linuxDesktop'
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
  // Contas do Codex, Gemini e Cursor: o nome (e-mail) delas aparece no menu Agente do grupo.
  step('conferir os agentes', () => s.providers.refresh())
  // Windows com WSL: o Claude Code de cada distro aparece em segundo plano (o primeiro wsl.exe liga
  // a máquina virtual). Com a resposta, o login é conferido de novo: sem o `claude` do Windows, é o
  // do WSL que vale.
  if (IS_LINUX) step('atalho no menu de apps', installDesktopEntry)
  if (IS_WIN) step('WSL', () => warmUp().then(() => s.auth.refresh()))
  step('comando argus', () => s.cli.start())
  step('atualizações', () => s.updater.start())
  step('versão do Claude Code', () => s.claudeVersion.start())
  // Ícone da barra de menus desligado por ora, mesmo para quem ligou: com conversa rodando, o
  // spinner trocava a imagem a cada 90 ms e mantinha o WindowServer ocupado. A barra de baixo mostra
  // o mesmo. Para voltar: s.tray.set(loadAppSettings().menuBarIcon) e o MenuBarIconRow nos ajustes.
  app.on('browser-window-focus', () => s.tray.seen())
  step('janelas do canvas', restoreCanvasWindows)
  const firstCanvas = activeCanvas()
  watchOpening(firstCanvas)
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
