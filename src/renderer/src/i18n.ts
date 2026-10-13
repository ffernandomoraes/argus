import { LOCALES, type Lang } from '../../shared/i18n'

// Idioma da interface, lido do processo principal antes do primeiro desenho. Trocar nos ajustes
// recarrega as janelas, então pode ficar em constante (inclusive textos no nível do módulo).
export const LANG: Lang = window.api.language.get() === 'en' ? 'en' : 'pt'
export const LOCALE = LOCALES[LANG]

// O texto no idioma da interface: tr('Abrir pasta', 'Open folder').
export const tr = (pt: string, en: string): string => (LANG === 'en' ? en : pt)

document.documentElement.lang = LOCALE
