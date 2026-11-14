import type { LangPreference } from '@argus/shared/i18n';

// Textos do app do celular em português ou inglês: o idioma escolhido em Conta > Preferências; sem
// escolha, o do Argus do computador (guardado da última conexão); no "sistema", o do navegador.
// Trocar recarrega o app (ver lib/preferences.ts).

function stored(): LangPreference {
  try {
    const own = (JSON.parse(localStorage.getItem('argus-phone-prefs') ?? '{}') as { language?: LangPreference }).language;
    return own ?? (localStorage.getItem('argus-desktop-language') as LangPreference | null) ?? 'system';
  } catch {
    return 'system';
  }
}

export const resolveLanguage = (pref: LangPreference): 'pt' | 'en' =>
  pref === 'system' ? (typeof navigator === 'undefined' || navigator.language.toLowerCase().startsWith('pt') ? 'pt' : 'en') : pref;

export const LANGUAGE = resolveLanguage(typeof localStorage === 'undefined' ? 'system' : stored());
const pt = LANGUAGE === 'pt';

export const LOCALE = pt ? 'pt-BR' : 'en-US';

export function tr(ptText: string, enText: string): string {
  return pt ? ptText : enText;
}
