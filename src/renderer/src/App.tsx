import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './canvas/Canvas'
import { SettingsModal } from './settings/SettingsModal'
import { useTheme } from './theme/useTheme'

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const theme = useTheme()
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])

  // ⌘, abre as configurações, como nos apps do Mac.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <main className="relative h-full">
      {/* Sem barra de título, é esta faixa invisível ao lado dos semáforos que
          arrasta a janela (e maximiza no duplo clique). Fica em z-20: acima do
          canvas, abaixo dos painéis (z-40) e dos modais (z-50). */}
      <div className="drag absolute left-0 top-0 z-20 h-9 w-[260px]" />
      <ReactFlowProvider>
        <Canvas colorMode={theme.resolved} onOpenSettings={openSettings} />
      </ReactFlowProvider>
      {settingsOpen && (
        <SettingsModal theme={theme.preference} onThemeChange={theme.setPreference} onClose={closeSettings} />
      )}
    </main>
  )
}
