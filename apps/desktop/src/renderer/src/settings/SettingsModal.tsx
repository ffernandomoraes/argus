import { useEffect } from 'react'
import type { ThemePreference } from '../theme/useTheme'
import { Modal } from '../ui/Modal'
import { isMod } from '../platform'
import { SettingsPage } from './SettingsPage'
import { getPreferences, setPreferences } from './preferences'
import { stepInterfaceZoom } from '@argus/shared/interfaceZoom'
import { tr } from '../i18n'

// Com as configurações abertas, ⌘+ e ⌘- (Ctrl no Windows) mudam o Tamanho da interface e ⌘0 volta
// a 100%. O ouvinte fica na fase de captura e para a tecla ali: o zoom do canvas e o do drawer,
// que escutam a mesma tecla na janela, não reagem por baixo do modal.
function interfaceZoomKey(e: KeyboardEvent): void {
  if (!isMod(e) || e.altKey) return
  // '+' e '_' aparecem quando o teclado manda a tecla já com shift.
  const direction = e.key === '=' || e.key === '+' ? 1 : e.key === '-' || e.key === '_' ? -1 : 0
  if (direction) setPreferences({ interfaceZoom: stepInterfaceZoom(getPreferences().interfaceZoom, direction) })
  else if (e.key === '0') setPreferences({ interfaceZoom: 1 })
  else return
  e.preventDefault()
  e.stopImmediatePropagation()
}

// Configurações por cima do canvas; fecha no X, no Esc ou clicando fora.
export function SettingsModal({
  theme,
  onThemeChange,
  onClose
}: {
  theme: ThemePreference
  onThemeChange: (t: ThemePreference) => void
  onClose: () => void
}) {
  useEffect(() => {
    window.addEventListener('keydown', interfaceZoomKey, true)
    return () => window.removeEventListener('keydown', interfaceZoomKey, true)
  }, [])

  return (
    <Modal label={tr('Configurações', 'Settings')} onClose={onClose}>
      <SettingsPage theme={theme} onThemeChange={onThemeChange} />
    </Modal>
  )
}
