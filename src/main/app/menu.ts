import { app, BrowserWindow, Menu } from 'electron'
import type { EditAction } from '../../shared/ipc'
import { sendTo } from '../ipc/events'
import { IS_MAC } from '../platform'
import { tr } from '../i18n'
import { createCanvasWindow } from './windows'

// Menu sem os itens de zoom padrão: ⌘+ / ⌘- / ⌘0 ficam para o canvas.
// O menu Editar é mantido porque copiar e colar (prints no chat) dependem dele.
// No Windows não há menu: a barra de título é a do app. Copiar e colar o navegador já faz sozinho,
// e Ctrl+Z / Ctrl+Shift+Z chegam à interface pelo preload, como os do menu Editar.

function sendEdit(win: Electron.BaseWindow | undefined, action: EditAction): void {
  if (win instanceof BrowserWindow) sendTo(win.webContents, 'edit', action)
}

let lastCheck: (() => Promise<void>) | null = null

// Idioma trocado nos ajustes: refaz o menu com os textos novos.
export function refreshAppMenu(): void {
  if (lastCheck) setAppMenu(lastCheck)
}

export function setAppMenu(checkForUpdates: () => Promise<void>): void {
  lastCheck = checkForUpdates
  if (!IS_MAC) return Menu.setApplicationMenu(null)
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { role: 'about' },
          {
            label: tr('Procurar atualizações…', 'Check for Updates…'),
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
        label: tr('Arquivo', 'File'),
        // Outra janela do mesmo canvas, para levar a outro monitor.
        submenu: [{ label: tr('Nova janela do canvas', 'New Canvas Window'), accelerator: 'Shift+CmdOrCtrl+N', click: () => void createCanvasWindow() }]
      },
      {
        label: tr('Editar', 'Edit'),
        submenu: [
          // Desfazer/refazer vão para a interface decidir: texto em edição ou canvas.
          { label: tr('Desfazer', 'Undo'), accelerator: 'CmdOrCtrl+Z', click: (_i, win) => sendEdit(win, 'undo') },
          { label: tr('Refazer', 'Redo'), accelerator: 'Shift+CmdOrCtrl+Z', click: (_i, win) => sendEdit(win, 'redo') },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' }
        ]
      },
      {
        label: tr('Ver', 'View'),
        submenu: [
          // A interface decide: com a página do protótipo aberta, recarrega só ela (ver preload/keys.ts).
          {
            label: tr('Recarregar', 'Reload'),
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
