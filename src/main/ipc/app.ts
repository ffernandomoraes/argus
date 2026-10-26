import { app, BrowserWindow, dialog } from 'electron'
import { resolveAccount } from '../accounts'
import { accentColor, setTheme } from '../app/appearance'
import type { Lifecycle } from '../app/lifecycle'
import type { Services } from '../app/services'
import { refreshAppMenu } from '../app/menu'
import { mediaCommand, nowPlaying, setVolume } from '../media'
import { loadAppSettings, saveAppSettings } from '../appSettings'
import { lang, setLang, tr } from '../i18n'
import { broadcast } from './events'
import { ensureDistro, homeUnc, listDistros } from '../wsl'
import { wslDiagnostics } from '../wsl/diagnostics'
import { parseAgentRef } from '../../shared/providers'
import { agentInfo } from '../agentChats/models'
import { setOrchestrationEnabled } from '../orchestration'
import { handle, on, onSync } from './register'
import { syncWorkspace } from '../workspaces'
import { IS_MAC } from '../platform'
import { isInterfaceZoom } from '../../shared/interfaceZoom'
import { CLIPBOARD_COMMANDS } from '../../shared/ipc'
import { setInterfaceZoom } from '../app/windowChrome'
import { fetchReleaseNotes } from '../updater/notes'

// O app em si: aparência, preferências, atualização, janelas de conversa avulsas e limites de uso.
export function registerAppIpc(s: Services, life: Lifecycle): void {
  on('theme:set', (_e, theme) => setTheme(theme))
  on('interface:zoom', (e, factor) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (win && isInterfaceZoom(factor)) setInterfaceZoom(win, factor)
  })
  // Vem da tela: só os três comandos conhecidos.
  on('clipboard:command', (e, command) => {
    if (CLIPBOARD_COMMANDS.includes(command)) e.sender[command]()
  })
  onSync('accent:get', () => accentColor())
  onSync('language:get', () => lang())
  handle('dialog:pickFolder', async (e, distro) => (await pickFolders(e.sender, distro, false))[0] ?? null)
  handle('dialog:pickFolders', (e, distro) => pickFolders(e.sender, distro, true))
  // Uma pasta, ou várias de uma vez (workspace: sem abrir o seletor uma vez por pasta). O seletor do
  // Mac, do Windows e do GTK no Linux aceitam marcar várias pastas.
  const MOD = IS_MAC ? '⌘' : 'Ctrl'
  async function pickFolders(sender: Electron.WebContents, distro: string | undefined, multiple: boolean): Promise<string[]> {
    const win = BrowserWindow.fromWebContents(sender)
    // Pasta do WSL: abre na pasta do usuário no Linux (\\wsl.localhost\<distro>\home\<usuário>).
    const wslHome = typeof distro === 'string' && distro ? (await ensureDistro(distro), homeUnc(distro)) : null
    const options: Electron.OpenDialogOptions = {
      title: multiple
        ? wslHome
          ? tr(`Escolha as pastas no WSL (${distro}) - marque várias com Ctrl ou Shift`, `Choose the folders in WSL (${distro}) - select several with Ctrl or Shift`)
          : tr(`Escolha as pastas - marque várias com ${MOD} ou Shift`, `Choose the folders - select several with ${MOD} or Shift`)
        : wslHome
          ? tr(`Escolha a pasta do projeto no WSL (${distro})`, `Choose the project folder in WSL (${distro})`)
          : tr('Escolha a pasta do projeto', 'Choose the project folder'),
      // O Mac não mostra o título no seletor, só esta mensagem.
      ...(multiple && { message: tr(`Marque várias pastas com ${MOD} ou Shift`, `Select several folders with ${MOD} or Shift`) }),
      buttonLabel: tr('Adicionar', 'Add'),
      defaultPath: wslHome ?? app.getPath('desktop'),
      properties: ['openDirectory', 'createDirectory', ...(multiple ? (['multiSelections'] as const) : [])]
    }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return result.canceled ? [] : result.filePaths
  }
  handle('workspace:sync', (_e, folders, dir) => syncWorkspace(folders, dir))
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
  handle('updates:notes', () => fetchReleaseNotes())
  on('updates:install', () => life.restartToUpdate())
  on('popout:open', (_e, id, payload) => s.popouts.show(id, payload))
  // Mascote solto na tela. Ligar, "escrevendo" e voltar ao canto vêm das janelas do app; o resto,
  // só da janela dele.
  on('mascot:enabled', (_e, enabled) => s.mascot.setEnabled(enabled))
  on('mascot:typing', (_e, typing) => s.mascot.setTyping(typing))
  on('mascot:interactive', (e, interactive) => s.mascot.owns(e.sender) && s.mascot.setInteractive(interactive))
  on('mascot:drag', (e, x, y) => s.mascot.owns(e.sender) && s.mascot.dragTo(x, y))
  on('mascot:dragEnd', (e) => s.mascot.owns(e.sender) && s.mascot.dragEnd())
  // Voltar ao canto: dois cliques no boneco ou o botão das configurações.
  on('mascot:home', () => s.mascot.home())
  handle('mascot:alerts', () => s.mascot.alerts())
  on('mascot:target', (e, key, turn, rect) => s.mascot.reportTarget(e.sender, key, turn, rect))
  handle('mascot:findTarget', (_e, key, turn) => s.mascot.findTarget(key, turn))
  handle('mascot:walk', (e, x, y) => (s.mascot.owns(e.sender) ? s.mascot.walk(x, y) : undefined))
  handle('mascot:homeSpot', () => s.mascot.homeSpot())
  on('orchestrator:enabled', (_e, enabled) => setOrchestrationEnabled(enabled))
  handle('popout:payload', (_e, id) => s.popouts.payload(id))
  handle('usage:get', () => s.usage.all())
  on('usage:refresh', () => s.usage.refresh(true))
  handle('media:get', () => nowPlaying())
  handle('media:command', (_e, command) => mediaCommand(command))
  handle('media:volume', (_e, volume) => setVolume(volume))
  handle('claude:info', (_e, account) => {
    // Conta de outro agente ("codex:main"): os modelos que ela oferece, no mesmo formato.
    const agent = parseAgentRef(account)
    return agent ? agentInfo(agent) : s.usage.info(resolveAccount(account))
  })
  handle('claudeVersion:get', () => s.claudeVersion.state)
  handle('claudeVersion:check', () => s.claudeVersion.check())
  handle('claudeVersion:update', () => s.claudeVersion.update())
}
