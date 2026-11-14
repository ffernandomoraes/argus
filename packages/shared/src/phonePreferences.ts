import type { ChatSettings } from './chat';
import type { LangPreference } from './i18n';
import type { ThemeSource } from './ipc';

// O que o app do celular herda do Argus até a pessoa escolher outro no próprio celular (ver
// apps/desktop/src/main/phonePreferences.ts e apps/mobile/src/lib/preferences.ts).

// Contado pela janela do Argus (fica nos ajustes dela).
export type SharedPreferences = { conversation: ChatSettings; suggestions: boolean };

// Entregue ao celular. Nulo: a janela ainda não contou.
export type DesktopPreferences = {
  conversation: ChatSettings | null
  suggestions: boolean | null
  theme: ThemeSource
  language: LangPreference
};
