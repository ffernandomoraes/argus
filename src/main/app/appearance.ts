import { nativeTheme, systemPreferences } from 'electron'
import type { ThemeSource } from '../../shared/ipc'
import { broadcast } from '../ipc/events'
import { IS_MAC } from '../platform'
import { repaintOverlays } from './windowChrome'

// Tema (claro, escuro ou o do sistema) e cor de destaque do sistema.

// Cor de destaque do sistema (Ajustes > Aparência no Mac, Personalização > Cores no Windows): a
// interface usa nela o item selecionado e os botões ligados. Vem como "rrggbbaa"; nulo onde o
// sistema não informa (aí fica o azul padrão do index.css).
export function accentColor(): string | null {
  try {
    const c = systemPreferences.getAccentColor()
    return /^[0-9a-f]{6}/i.test(c) ? `#${c.slice(0, 6)}` : null
  } catch {
    return null
  }
}

export function setTheme(theme: ThemeSource): void {
  nativeTheme.themeSource = theme
  repaintOverlays()
}

// Tema ou cor de destaque trocados no sistema: os botões do Windows e as janelas acompanham.
export function watchAppearance(): void {
  nativeTheme.on('updated', repaintOverlays)
  const sendAccent = (): void => broadcast('accent:changed', accentColor())
  if (IS_MAC) systemPreferences.subscribeNotification('AppleColorPreferencesChangedNotification', sendAccent)
  else systemPreferences.on('accent-color-changed', sendAccent)
}
