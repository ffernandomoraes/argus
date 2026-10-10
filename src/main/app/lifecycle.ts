import { app, BrowserWindow } from 'electron'
import { IS_MAC, IS_WIN } from '../platform'
import { canvasWindowList, isCanvasWindow } from './canvasRegistry'
import { askToClose, busyShells, inProgress } from './closeQuestion'
import { QuitFlow } from './quitFlow'
import type { Services } from './services'
import { shutdown } from './shutdown'

// Ciclo de vida do app ligado aos eventos do Electron: a saída (ver QuitFlow), os sinais do modo de
// desenvolvimento, o desligamento do Windows e o que acontece quando as janelas fecham.

export type Lifecycle = {
  restartToUpdate: () => Promise<void>
  // Fecha sem perguntar (teste de fumaça).
  confirmAndQuit: () => void
}

export function setupLifecycle(s: Services): Lifecycle {
  const flow = new QuitFlow({
    inProgress: () => inProgress(s.chats, s.terminals, s.unsavedFiles),
    hasShells: () => s.terminals.hasShells(),
    busyShells: () => busyShells(s.terminals),
    ask: askToClose,
    shutdown: (install) => shutdown(s, install),
    terminalsClosing: () => s.terminals.hasClosing(),
    terminalsClosed: () => s.terminals.closed(),
    // Windows: depois do shutdown, a saída espera os terminais terminarem de fechar (ver
    // Terminals.closed); as janelas somem na hora. No Mac não há o que esperar.
    hideWindows: () => BrowserWindow.getAllWindows().forEach((w) => w.hide()),
    quit: () => app.quit(),
    exit: () => app.exit(0),
    updatePending: () => s.updater.pending,
    install: (relaunch) => s.updater.installAsync(relaunch)
  })

  app.on('before-quit', (e) => flow.beforeQuit(e))

  // O modo de desenvolvimento reinicia o app com SIGTERM a cada mudança no processo principal.
  // Sem tratar o sinal, um app ainda abrindo podia ignorá-lo e ficar aberto ao lado do novo.
  process.on('SIGTERM', () => flow.exitNow())
  // Ctrl+C no terminal que subiu o app também encerra tudo que ele abriu.
  process.on('SIGINT', () => flow.exitNow())

  app.on('browser-window-created', (_e, win) => {
    // Windows desligando ou saindo da conta: o before-quit não vem (ver QuitFlow.sessionEnd).
    if (IS_WIN) win.on('session-end', () => flow.sessionEnd())
    // No Windows não há Dock para reabrir o canvas: fechar a última janela dele fecha o app,
    // passando pela mesma pergunta de quando há algo rodando. As outras fecham normalmente.
    if (!IS_MAC) {
      win.on('close', (e) => {
        if (!isCanvasWindow(win) || flow.quitting || canvasWindowList().length > 1) return
        e.preventDefault()
        // Fora deste evento: cancelar o fechamento da janela também cancelaria um quit pedido aqui dentro.
        setImmediate(() => app.quit())
      })
    }
  })

  app.on('window-all-closed', () => {
    if (!IS_MAC) return app.quit()
    // No macOS o app segue no Dock; sem janela, nada precisa de sessão de chat aberta, e o
    // microfone de um ditado em andamento desliga.
    s.chats.releaseAll()
    s.speech.stop()
  })

  return { restartToUpdate: () => flow.restartToUpdate(), confirmAndQuit: () => flow.confirmAndQuit() }
}
