// Idioma da interface: português ou inglês. "system" segue o idioma do sistema operacional.
export type Lang = 'pt' | 'en'
export type LangPreference = Lang | 'system'

// Idiomas preferidos do sistema, em ordem ("pt-BR", "en-US", "es-ES"): o primeiro que for português
// ou inglês decide. Sistema em outro idioma (espanhol, francês…) fica em inglês.
export function langFromLocales(locales: readonly string[]): Lang {
  for (const l of locales) {
    const code = l.toLowerCase()
    if (code.startsWith('pt')) return 'pt'
    if (code.startsWith('en')) return 'en'
  }
  return 'en'
}

// Formato de data e número de cada idioma (toLocaleString, Intl).
export const LOCALES: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US' }
