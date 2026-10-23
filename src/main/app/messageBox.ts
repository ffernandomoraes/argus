import { BrowserWindow, dialog } from 'electron'
import { isAppWindow } from './windowChrome'

// Caixa de mensagem presa à janela do Argus em foco. No macOS, a caixa sem janela dona é síncrona:
// o processo principal para até a resposta, e com ele a saída dos terminais, as conversas e os
// status; nem o `signal` a fecha (ver a opção no electron.d.ts). Presa à janela, ela desce do topo
// dela e nada para; no Windows, a janela espera a resposta. Sem janela do Argus em foco (o app no
// Dock sem janela, fechado pelo Dock em segundo plano, ou a recuperação antes das janelas abrirem),
// a caixa fica solta, para aparecer na frente. O mascote nunca fica com ela.
export function showMessageBox(options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> {
  const win = BrowserWindow.getFocusedWindow()
  return win && isAppWindow(win) ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
}
