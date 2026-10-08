import { useCallback, useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useAuth } from './auth/useAuth'
import { WelcomeScreen } from './auth/WelcomeScreen'
import { Canvas } from './canvas/Canvas'
import { isMod } from './platform'
import { SettingsModal } from './settings/SettingsModal'
import { useTheme } from './theme/useTheme'
import { Presence } from './motion'

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const theme = useTheme()
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const auth = useAuth()
  // Nenhuma conta logada, depois de conferir todas. Com outra conta logada, a principal sem login
  // aparece só em Configurações. Sem o Claude Code na máquina, a mesma tela oferece instalar.
  const loggedOut = !!auth?.accounts.length && auth.accounts.every((a) => a.status?.loggedIn === false)
  const welcome = !!auth && (auth.claude.status !== 'found' || loggedOut)

  // Saiu de todas as contas: as configurações fecham e fica a tela de login.
  useEffect(() => {
    if (welcome) setSettingsOpen(false)
  }, [welcome])

  // ⌘, abre as configurações, como nos apps do Mac (Ctrl+, no Windows, como no VS Code).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isMod(e) && e.key === ',') {
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
      {welcome && auth && <WelcomeScreen login={auth.login} claude={auth.claude} />}
      <Presence kind="modal">
        {settingsOpen && !welcome && (
          <SettingsModal theme={theme.preference} onThemeChange={theme.setPreference} onClose={closeSettings} />
        )}
      </Presence>
    </main>
  )
}
