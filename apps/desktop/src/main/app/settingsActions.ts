import type { AppSettings } from '@argus/shared/appSettings';
import type { LangPreference } from '@argus/shared/i18n';
import { saveAppSettings } from '../appSettings';
import { setLang } from '../i18n';
import { broadcast } from '../ipc/events';
import { refreshAppMenu } from './menu';
import type { MenuBarIcon } from './menuBarIcon';

// Trocas de configuração com efeito além de gravar, num lugar só: as Configurações (ipc/app.ts) e a
// conta do Argus (preferência que veio de outro computador, ver account/mainSettings.ts) fazem igual.

// Idioma trocado: menu e ícone do sistema refeitos aqui; as janelas recarregam (renderer/i18n).
export function applyLanguage(pref: LangPreference, tray: MenuBarIcon): AppSettings {
  const saved = saveAppSettings({ language: pref });
  setLang(pref);
  refreshAppMenu();
  tray.refresh();
  broadcast('language:changed');
  return saved;
}

export function applyMenuBarIcon(enabled: boolean, tray: MenuBarIcon): AppSettings {
  tray.set(enabled);
  return saveAppSettings({ menuBarIcon: enabled });
}
