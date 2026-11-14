import { useSyncExternalStore } from 'react';
import type { ChatSettings } from '@argus/shared/chat';
import type { LangPreference } from '@argus/shared/i18n';
import type { ThemeSource } from '@argus/shared/ipc';
import type { DesktopPreferences } from '@argus/shared/phonePreferences';
import { setWindowTheme } from './windowColor';

// Preferências deste celular (Conta > Preferências). O que não foi escolhido aqui segue o Argus do
// computador (idioma, tema, sugestões e o padrão das conversas novas, ver preferences:forPhone).

export type PhonePreferences = { language?: LangPreference; theme?: ThemeSource; suggestions?: boolean; conversation?: ChatSettings };

const KEY = 'argus-phone-prefs';
// Idioma herdado do computador na última leitura: o idioma vale desde o primeiro texto, antes de
// conectar (ver i18n.ts).
export const DESKTOP_LANGUAGE_KEY = 'argus-desktop-language';
const CHANGED = 'argus-phone-prefs-changed';

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? '{}';
  } catch {
    return '{}';
  }
}

export function loadPhonePreferences(): PhonePreferences {
  try {
    return JSON.parse(read()) as PhonePreferences;
  } catch {
    return {};
  }
}

export function savePhonePreferences(patch: PhonePreferences): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...loadPhonePreferences(), ...patch }));
  } catch {
    // sem armazenamento: vale até fechar o app
  }
  window.dispatchEvent(new Event(CHANGED));
}

const subscribe = (cb: () => void) => {
  window.addEventListener(CHANGED, cb);
  return () => window.removeEventListener(CHANGED, cb);
};

export function usePhonePreferences(): PhonePreferences {
  const raw = useSyncExternalStore(subscribe, read);
  try {
    return JSON.parse(raw) as PhonePreferences;
  } catch {
    return {};
  }
}

export type EffectivePreferences = { language: LangPreference; theme: ThemeSource; suggestions: boolean; conversation: ChatSettings | null };

// O escolhido aqui; senão, o do computador; senão, o padrão do app.
export function effectivePreferences(phone: PhonePreferences, desktop: DesktopPreferences | null): EffectivePreferences {
  return {
    language: phone.language ?? desktop?.language ?? 'system',
    theme: phone.theme ?? desktop?.theme ?? 'system',
    suggestions: phone.suggestions ?? desktop?.suggestions ?? true,
    conversation: phone.conversation ?? desktop?.conversation ?? null,
  };
}

// Tema escolhido: a página segue ele em vez do sistema (ver index.css), e a barra da janela junto.
export function applyTheme(theme: ThemeSource): void {
  const root = document.documentElement;
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  setWindowTheme(theme);
}
