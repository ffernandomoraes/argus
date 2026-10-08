import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useAuth } from './auth/useAuth'
import { WelcomeScreen } from './auth/WelcomeScreen'
import { Canvas } from './canvas/Canvas'
import { SettingsModal } from './settings/SettingsModal'
import { useTheme } from './theme/useTheme'
import { Presence } from './motion'

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const theme = useTheme()
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const auth = useAuth()
  // Nenhuma conta logada, depois de conferir todas: sem resposta (claude não instalado) o canvas
  // abre normal. Com outra conta logada, a principal sem login aparece só em Configurações.
  const loggedOut = !!auth?.accounts.length && auth.accounts.every((a) => a.status?.loggedIn === false)

  // Saiu de todas as contas: as configurações fecham e fica a tela de login.
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
      <Presence kind="modal">
        {settingsOpen && !loggedOut && (
          <SettingsModal theme={theme.preference} onThemeChange={theme.setPreference} onClose={closeSettings} />
        )}
      </Presence>
    </main>
  )
}
