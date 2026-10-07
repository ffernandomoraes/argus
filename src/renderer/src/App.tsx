import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useAuth } from './auth/useAuth'
import { WelcomeScreen } from './auth/WelcomeScreen'
import { Canvas } from './canvas/Canvas'
import { SettingsModal } from './settings/SettingsModal'
import { useTheme } from './theme/useTheme'

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const theme = useTheme()
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const auth = useAuth()
  // Só depois de conferir: sem resposta (claude não instalado) o canvas abre normal.
  const loggedOut = auth?.account?.loggedIn === false

  // Saiu pela tela de Conta: as configurações fecham e fica a tela de login.
  useEffect(() => {
    if (loggedOut) setSettingsOpen(false)
  }, [loggedOut])

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
      <ReactFlowProvider>
        <Canvas colorMode={theme.resolved} onOpenSettings={openSettings} />
      </ReactFlowProvider>
      {loggedOut && auth && <WelcomeScreen login={auth.login} />}
      {settingsOpen && !loggedOut && (
        <SettingsModal theme={theme.preference} onThemeChange={theme.setPreference} onClose={closeSettings} />
      )}
    </main>
  )
}
