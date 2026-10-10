import type { ThemePreference } from '../theme/useTheme'
import { Modal } from '../ui/Modal'
import { SettingsPage } from './SettingsPage'

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
  return (
    <Modal label="Configurações" onClose={onClose}>
      <SettingsPage theme={theme} onThemeChange={onThemeChange} onClose={onClose} />
    </Modal>
  )
}
