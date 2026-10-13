import type { LangPreference } from './i18n'

// Preferências que o processo principal precisa antes de abrir a janela (as do renderer ficam no
// localStorage, que só existe depois).
export type AppSettings = {
  // Ícone na barra de menus do macOS com o status das conversas.
  menuBarIcon: boolean
  // Idioma da interface; "system" segue o do sistema operacional.
  language: LangPreference
}
