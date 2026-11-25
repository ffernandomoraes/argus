import type { MainSyncValues } from '@argus/shared/accountSync';
import type { LangPreference } from '@argus/shared/i18n';
import { STORAGE_DAY_OPTIONS, type StorageSettings } from '@argus/shared/storage';
import { loadAppSettings, saveAppSettings } from '../appSettings';

// As preferências do processo principal que vão para a conta: ler as de agora e aplicar as que
// vieram de outro computador, com os mesmos efeitos de quando a pessoa muda nas Configurações.

export type MainSettingsHooks = {
  language(pref: LangPreference): void
  menuBarIcon(enabled: boolean): void
  storage(): StorageSettings
  setStorage(patch: Partial<StorageSettings>): void
};

export function readMainValues(hooks: MainSettingsHooks): MainSyncValues {
  const s = loadAppSettings();
  return {
    language: s.language,
    notifications: s.notifications,
    notificationSound: s.notificationSound,
    menuBarIcon: s.menuBarIcon,
    storage: hooks.storage(),
  };
}

// Só os prazos que a aba Armazenamento oferece (um de 1 dia vindo da conta apagaria o histórico) e só
// os que mudaram: aplicar o mesmo faria a aba Armazenamento medir o disco de novo.
function storagePatch(v: unknown, current: StorageSettings): Partial<StorageSettings> | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const patch: Partial<StorageSettings> = {};
  for (const k of ['conversationDays', 'scratchDays', 'mediaDays'] as const) {
    const d = o[k];
    if (typeof d === 'number' && STORAGE_DAY_OPTIONS[k].includes(d) && d !== current[k]) patch[k] = d;
  }
  return Object.keys(patch).length ? patch : null;
}

const isLanguage = (v: unknown): v is LangPreference => v === 'system' || v === 'pt' || v === 'en';

// Valor fora do formato (de outra versão do app, por exemplo) fica de fora sem avisar.
export function applyMainValues(values: MainSyncValues, hooks: MainSettingsHooks): void {
  const current = loadAppSettings();
  const { language, notifications, notificationSound, menuBarIcon, storage } = values;
  if (typeof notifications === 'boolean' && notifications !== current.notifications) saveAppSettings({ notifications });
  if (typeof notificationSound === 'boolean' && notificationSound !== current.notificationSound) saveAppSettings({ notificationSound });
  if (typeof menuBarIcon === 'boolean' && menuBarIcon !== current.menuBarIcon) hooks.menuBarIcon(menuBarIcon);
  const patch = storagePatch(storage, hooks.storage());
  if (patch) hooks.setStorage(patch);
  // Por último: troca de idioma recarrega as janelas.
  if (isLanguage(language) && language !== current.language) hooks.language(language);
}
