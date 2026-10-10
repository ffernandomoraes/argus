import { app, BrowserWindow, dialog } from 'electron'
import { resolveAccount } from '../accounts'
import { accentColor, setTheme } from '../app/appearance'
import type { Lifecycle } from '../app/lifecycle'
import type { Services } from '../app/services'
import { loadAppSettings, saveAppSettings } from '../appSettings'
import { handle, on, onSync } from './register'

// O app em si: aparência, preferências, atualização, janelas de conversa avulsas e limites de uso.
export function registerAppIpc(s: Services, life: Lifecycle): void {
  on('theme:set', (_e, theme) => setTheme(theme))
  onSync('accent:get', () => accentColor())
  handle('dialog:pickFolder', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const options: Electron.OpenDialogOptions = {
      title: 'Escolha a pasta do projeto',
      buttonLabel: 'Adicionar',
      defaultPath: app.getPath('desktop'),
      properties: ['openDirectory', 'createDirectory']
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return result.canceled ? null : result.filePaths[0]
  })
  handle('settings:get', () => loadAppSettings())
  handle('settings:menuBarIcon', (_e, enabled) => {
    s.tray.set(enabled)
    return saveAppSettings({ menuBarIcon: enabled })
  })
  handle('updates:get', () => ({ version: app.getVersion(), state: s.updater.state }))
  handle('updates:check', () => s.updater.check())
  on('updates:install', () => life.restartToUpdate())
  on('popout:open', (_e, id, payload) => s.popouts.show(id, payload))
  handle('popout:payload', (_e, id) => s.popouts.payload(id))
  handle('usage:get', () => s.usage.all())
  handle('claude:info', (_e, account) => s.usage.info(resolveAccount(account)))
}
