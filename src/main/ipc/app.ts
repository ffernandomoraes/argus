import { app, BrowserWindow, dialog } from 'electron'
import { resolveAccount } from '../accounts'
import { accentColor, setTheme } from '../app/appearance'
import type { Lifecycle } from '../app/lifecycle'
import type { Services } from '../app/services'
import { refreshAppMenu } from '../app/menu'
import { loadAppSettings, saveAppSettings } from '../appSettings'
import { lang, setLang, tr } from '../i18n'
import { broadcast } from './events'
import { ensureDistro, homeUnc, listDistros } from '../wsl'
import { wslDiagnostics } from '../wsl/diagnostics'
import { handle, on, onSync } from './register'

// O app em si: aparência, preferências, atualização, janelas de conversa avulsas e limites de uso.
export function registerAppIpc(s: Services, life: Lifecycle): void {
  on('theme:set', (_e, theme) => setTheme(theme))
  onSync('accent:get', () => accentColor())
  onSync('language:get', () => lang())
  handle('dialog:pickFolder', async (e, distro) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    // Pasta do WSL: abre na pasta do usuário no Linux (\\wsl.localhost\<distro>\home\<usuário>).
    const wslHome = typeof distro === 'string' && distro ? (await ensureDistro(distro), homeUnc(distro)) : null
    const options: Electron.OpenDialogOptions = {
      title: wslHome
        ? tr(`Escolha a pasta do projeto no WSL (${distro})`, `Choose the project folder in WSL (${distro})`)
        : tr('Escolha a pasta do projeto', 'Choose the project folder'),
      buttonLabel: tr('Adicionar', 'Add'),
      defaultPath: wslHome ?? app.getPath('desktop'),
      properties: ['openDirectory', 'createDirectory']
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return result.canceled ? null : result.filePaths[0]
  })
  handle('wsl:distros', () => listDistros())
  handle('wsl:diagnostics', () => wslDiagnostics())
  handle('settings:get', () => loadAppSettings())
  handle('settings:menuBarIcon', (_e, enabled) => {
    s.tray.set(enabled)
    return saveAppSettings({ menuBarIcon: enabled })
  })
  // Idioma trocado: menu e ícone do sistema refeitos aqui; as janelas recarregam (renderer/i18n).
  handle('settings:language', (_e, pref) => {
    const saved = saveAppSettings({ language: pref })
    setLang(pref)
    refreshAppMenu()
    s.tray.refresh()
    broadcast('language:changed')
    return saved
  })
  handle('updates:get', () => ({ version: app.getVersion(), state: s.updater.state }))
  handle('updates:check', () => s.updater.check())
  on('updates:install', () => life.restartToUpdate())
  on('popout:open', (_e, id, payload) => s.popouts.show(id, payload))
  handle('popout:payload', (_e, id) => s.popouts.payload(id))
  handle('usage:get', () => s.usage.all())
  handle('claude:info', (_e, account) => s.usage.info(resolveAccount(account)))
}
