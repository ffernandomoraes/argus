import { app } from 'electron'
import { LOCALES, langFromLocales, type Lang, type LangPreference } from '../shared/i18n'
import { loadAppSettings } from './appSettings'

// Idioma da interface no processo principal (menu, diálogos, notificações). Lido na hora de usar:
// texto guardado em constante no carregamento do módulo não acompanha a troca nos ajustes.

let current: Lang | null = null

export function resolveLang(pref: LangPreference): Lang {
  return pref === 'system' ? langFromLocales(app.getPreferredSystemLanguages()) : pref
}

export function lang(): Lang {
  return (current ??= resolveLang(loadAppSettings().language))
}

// Ajuste trocado: vale para o próximo texto pedido.
export function setLang(pref: LangPreference): Lang {
  current = resolveLang(pref)
  return current
}

export const locale = (): string => LOCALES[lang()]

// O texto no idioma da interface: tr('Abrir pasta', 'Open folder').
export const tr = (pt: string, en: string): string => (lang() === 'en' ? en : pt)
