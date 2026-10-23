import type { LangPreference } from './i18n'

// Preferências que o processo principal precisa antes de abrir a janela (as do renderer ficam no
// localStorage, que só existe depois).
export type AppSettings = {
  // Ícone na barra de menus do macOS com o status das conversas.
  menuBarIcon: boolean
  // Idioma da interface; "system" segue o do sistema operacional.
  language: LangPreference
  // Onde o mascote solto na tela ficou (canto de cima da janela dele, em coordenadas da tela).
  // Nulo: o canto de baixo à esquerda da tela principal.
  mascotSpot: { x: number; y: number } | null
  // Número aleatório desta instalação: conta quantas máquinas tiveram cada erro, sem dizer de quem.
  installId?: string
}

