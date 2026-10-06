import { useEffect } from 'react'
import type { ThemePreference } from '../theme/useTheme'
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-label="Configurações"
        className="h-[min(600px,100%)] w-[min(860px,100%)] overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/50"
      >
        <SettingsPage theme={theme} onThemeChange={onThemeChange} onClose={onClose} />
      </div>
    </div>
  )
}
