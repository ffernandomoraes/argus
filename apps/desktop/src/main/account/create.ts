import { Notification, powerMonitor } from 'electron';
import type { MenuBarIcon } from '../app/menuBarIcon';
import { loadAppSettings } from '../appSettings';
import { applyLanguage, applyMenuBarIcon } from '../app/settingsActions';
import { showApp } from '../app/windows';
import { broadcastLocal } from '../ipc/events';
import { remoteAccess } from '../remote';
import type { Boards } from '../boards';
import type { StorageCleaner } from '../storage';
import { AccountService } from '.';
import { AWAY_SECONDS, type IncomingNotice } from './notices';

// Aviso de outro computador da conta: notificação do sistema com o nome dele. O clique traz o Argus
// e, com o acesso remoto ligado lá, abre aquele computador (pareando pela conta se precisar).
function showNotice(notice: IncomingNotice): void {
  if (!Notification.isSupported() || !loadAppSettings().notifications) return;
  const n = new Notification({ title: `${notice.from}: ${notice.title}`, body: notice.body });
  n.on('click', () => {
    showApp();
    if (notice.hostId) void remoteAccess().openAccountHost(notice.hostId);
  });
  n.show();
}

// A conta ligada ao resto do app: as preferências do processo principal aplicadas com os mesmos
// efeitos das Configurações e os avisos só para as janelas deste computador (a conta é da máquina).
// `boards`: os workspaces nascem depois da conta, então vêm por função.
export function createAccount(tray: MenuBarIcon, storage: StorageCleaner, boards: () => Boards): AccountService {
  const account = new AccountService({
    settings: {
      language: (pref) => void applyLanguage(pref, tray),
      menuBarIcon: (enabled) => void applyMenuBarIcon(enabled, tray),
      storage: () => storage.settings(),
      setStorage: (patch) => void storage.setSettings(patch),
    },
    emitState: (state) => {
      broadcastLocal('account:state', state);
      // O acesso remoto pela conta acompanha o login (ver remote/accountRemote.ts).
      remoteAccess().setAccount(account.remoteBridge());
    },
    applyRenderer: (values) => broadcastLocal('account:applyPrefs', values),
    showApp,
    boards: () => {
      const b = boards();
      return {
        everything: () => b.everything(),
        names: () => b.everything().map((e) => e.name),
        create: (name, nodes) => {
          const id = b.create(name);
          b.put(id, nodes);
          return id;
        },
      };
    },
    // Sem resposta do sistema ('unknown', em alguns Linux), conta como alguém na frente: melhor faltar
    // aviso do que repetir em todos os computadores.
    away: () => ['idle', 'locked'].includes(powerMonitor.getSystemIdleState(AWAY_SECONDS)),
    remoteHostId: () => remoteAccess().accountHostId(),
    showNotice,
    remoteDevices: {
      removed: (sessionId) => remoteAccess().accountSide.devices.removed(sessionId),
      check: () => void remoteAccess().accountSide.devices.sweep(),
      accountGone: () => remoteAccess().accountSide.devices.gone(),
    },
  });
  account.start();
  return account;
}
