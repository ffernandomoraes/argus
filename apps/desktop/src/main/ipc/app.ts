import { app, BrowserWindow, dialog } from 'electron';
import { resolveAccount } from '../accounts';
import { setTheme } from '../app/appearance';
import type { Lifecycle } from '../app/lifecycle';
import type { Services } from '../app/services';
import { mediaCommand, nowPlaying, setVolume } from '../media';
import { loadAppSettings, saveAppSettings } from '../appSettings';
import { lang, tr } from '../i18n';
import { ensureDistro, homeUnc, listDistros } from '../wsl';
import { wslDiagnostics } from '../wsl/diagnostics';
import { setSharedLoginEnabled } from '../wsl/sharedLogin';
import { parseAgentRef } from '@argus/shared/providers';
import { agentInfo } from '../agentChats/models';
import { handle, on, onSync } from './register';
import { contentsOf, isRemotePage } from './page';
import { syncWorkspace } from '../workspaces';
import { cloneRepository } from '../gitClone';
import { forgetLocalClones, localClones } from '../localClones';
import { IS_MAC } from '../platform';
import { isInterfaceZoom } from '@argus/shared/interfaceZoom';
import { CLIPBOARD_COMMANDS } from '@argus/shared/ipc';
import { setInterfaceZoom } from '../app/windowChrome';
import { applyLanguage, applyMenuBarIcon } from '../app/settingsActions';
import { fetchReleaseNotes } from '../updater/notes';
import { telemetry } from '../telemetry';
import { telemetrySources } from '../telemetry/sources';

// O app em si: aparência, preferências, atualização, janelas de conversa avulsas e limites de uso.
export function registerAppIpc(s: Services, life: Lifecycle): void {
  on('theme:set', (_e, theme) => setTheme(theme));
  on('interface:zoom', (e, factor) => {
    const wc = contentsOf(e.sender);
    const win = wc && BrowserWindow.fromWebContents(wc);
    if (win && isInterfaceZoom(factor)) setInterfaceZoom(win, factor);
  });
  // Vem da tela: só os três comandos conhecidos.
  on('clipboard:command', (e, command) => {
    if (CLIPBOARD_COMMANDS.includes(command)) contentsOf(e.sender)?.[command]();
  });
  onSync('language:get', () => lang());
  handle('dialog:pickFolder', async (e, distro) => (await pickFolders(contentsOf(e.sender), distro, false))[0] ?? null);
  handle('dialog:pickFolders', (e, distro) => pickFolders(contentsOf(e.sender), distro, true));
  // Onde pôr o repositório clonado: abre na última pasta escolhida (nesta abertura do app).
  let cloneParent: string | null = null;
  handle('dialog:pickCloneParent', async (e) => {
    const wc = contentsOf(e.sender);
    const win = wc && BrowserWindow.fromWebContents(wc);
    const options: Electron.OpenDialogOptions = {
      title: tr('Escolha onde clonar o repositório', 'Choose where to clone the repository'),
      message: tr('O repositório entra numa pasta nova dentro desta.', 'The repository goes into a new folder inside this one.'),
      buttonLabel: tr('Clonar aqui', 'Clone here'),
      defaultPath: cloneParent ?? app.getPath('home'),
      properties: ['openDirectory', 'createDirectory'],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return null;
    cloneParent = result.filePaths[0];
    return cloneParent;
  });
  // Uma pasta, ou várias de uma vez (workspace: sem abrir o seletor uma vez por pasta). O seletor do
  // Mac, do Windows e do GTK no Linux aceitam marcar várias pastas.
  const MOD = IS_MAC ? '⌘' : 'Ctrl';
  async function pickFolders(sender: Electron.WebContents | null, distro: string | undefined, multiple: boolean): Promise<string[]> {
    const win = sender && BrowserWindow.fromWebContents(sender);
    // Pasta do WSL: abre na pasta do usuário no Linux (\\wsl.localhost\<distro>\home\<usuário>).
    const wslHome = typeof distro === 'string' && distro ? (await ensureDistro(distro), homeUnc(distro)) : null;
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
      properties: ['openDirectory', 'createDirectory', ...(multiple ? (['multiSelections'] as const) : [])],
    };
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options);
    return result.canceled ? [] : result.filePaths;
  }
  handle('workspace:sync', (_e, folders, dir) => syncWorkspace(folders, dir));
  handle('git:localClones', () => localClones());
  handle('git:clone', async (_e, url, parent, name) => {
    if (typeof url !== 'string' || typeof parent !== 'string' || typeof name !== 'string') return { ok: false as const, error: 'invalid' };
    const result = await cloneRepository(url, parent, name, await s.account.github.cloneToken(url));
    if (result.ok) forgetLocalClones();
    return result;
  });
  handle('wsl:distros', () => listDistros());
  handle('wsl:diagnostics', () => wslDiagnostics());
  handle('settings:get', () => loadAppSettings());
  // As que sincronizam com a conta do Argus avisam a conta (ver account/mainSettings.ts).
  const synced = <T>(saved: T): T => {
    s.account.mainChanged();
    return saved;
  };
  handle('settings:menuBarIcon', (_e, enabled) => synced(applyMenuBarIcon(enabled, s.tray)));
  handle('settings:notifications', (_e, enabled) => synced(saveAppSettings({ notifications: enabled })));
  handle('settings:notificationSound', (_e, enabled) => synced(saveAppSettings({ notificationSound: enabled })));
  handle('settings:usageStats', (_e, enabled) => {
    telemetry.setEnabled(enabled, telemetrySources(s));
    return loadAppSettings();
  });
  // O login das pastas do WSL mudou de lugar: as contas são conferidas de novo (as linhas do WSL
  // aparecem ou somem) e as conversas paradas reabrem com o login certo na próxima mensagem.
  handle('settings:wslSharedLogin', (_e, enabled) => {
    const saved = saveAppSettings({ wslSharedLogin: enabled });
    setSharedLoginEnabled(enabled);
    s.chats.releaseAll();
    void s.auth.refresh();
    return saved;
  });
  handle('settings:language', (_e, pref) => synced(applyLanguage(pref, s.tray)));
  handle('updates:get', () => ({ version: app.getVersion(), state: s.updater.state }));
  handle('updates:check', () => s.updater.check(true));
  handle('updates:notes', () => fetchReleaseNotes());
  // De outro computador (acesso remoto): a confirmação já foi feita na janela de lá; perguntar aqui
  // deixaria a atualização esperando alguém na frente deste computador.
  on('updates:install', (e) => life.restartToUpdate({ ask: !isRemotePage(e.sender) }));
  on('popout:open', (_e, id, payload) => s.popouts.show(id, payload));
  handle('popout:payload', (_e, id) => s.popouts.payload(id));
  handle('usage:get', () => s.usage.all());
  on('usage:refresh', () => s.usage.refresh(true));
  handle('media:get', () => nowPlaying());
  handle('media:command', (_e, command) => mediaCommand(command));
  handle('media:volume', (_e, volume) => setVolume(volume));
  handle('claude:info', (_e, account) => {
    // Conta de outro agente ("codex:main"): os modelos que ela oferece, no mesmo formato.
    const agent = parseAgentRef(account);
    return agent ? agentInfo(agent) : s.usage.info(resolveAccount(account));
  });
  handle('claudeVersion:get', () => s.claudeVersion.state);
  handle('claudeVersion:check', () => s.claudeVersion.check());
  handle('claudeVersion:update', () => s.claudeVersion.update());
}
