import { app, BrowserWindow, Menu } from 'electron'
import type { EditAction } from '../../shared/ipc'
import { sendTo } from '../ipc/events'
import { IS_MAC } from '../platform'
import { createCanvasWindow } from './windows'

// Menu sem os itens de zoom padrão: ⌘+ / ⌘- / ⌘0 ficam para o canvas.
// O menu Editar é mantido porque copiar e colar (prints no chat) dependem dele.
// No Windows não há menu: a barra de título é a do app. Copiar e colar o navegador já faz sozinho,
// e Ctrl+Z / Ctrl+Shift+Z chegam à interface pelo preload, como os do menu Editar.

function sendEdit(win: Electron.BaseWindow | undefined, action: EditAction): void {
  if (win instanceof BrowserWindow) sendTo(win.webContents, 'edit', action)
}

export function setAppMenu(checkForUpdates: () => Promise<void>): void {
  if (!IS_MAC) return Menu.setApplicationMenu(null)
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          {
            label: 'Procurar atualizações…',
            click: () => void checkForUpdates().catch((err: unknown) => console.error('[menu] atualizações:', err))
          },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'Arquivo',
        // Outra janela do mesmo canvas, para levar a outro monitor.
        submenu: [{ label: 'Nova janela do canvas', accelerator: 'Shift+CmdOrCtrl+N', click: () => void createCanvasWindow() }]
      },
      {
        label: 'Editar',
        submenu: [
          // Desfazer/refazer vão para a interface decidir: texto em edição ou canvas.
          { label: 'Desfazer', accelerator: 'CmdOrCtrl+Z', click: (_i, win) => sendEdit(win, 'undo') },
          { label: 'Refazer', accelerator: 'Shift+CmdOrCtrl+Z', click: (_i, win) => sendEdit(win, 'redo') },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: 'Ver',
        submenu: [
          // A interface decide: com a página do protótipo aberta, recarrega só ela (ver preload/keys.ts).
          {
            label: 'Recarregar',
            accelerator: 'CmdOrCtrl+R',
            click: (_i, win) => win instanceof BrowserWindow && sendTo(win.webContents, 'reload-request')
          },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      { role: 'windowMenu' }
    ])
  )
}
