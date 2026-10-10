import { useCallback, useEffect, useEffectEvent, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { useAuth } from './auth/useAuth'
import { Canvas } from './canvas/Canvas'
import { isMod } from './platform'
import { SettingsModal } from './settings/SettingsModal'
import { setPreferences, usePreference } from './settings/preferences'
import { useTheme } from './theme/useTheme'
import { Presence } from './motion'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { WelcomeModal } from './welcome/WelcomeModal'

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const theme = useTheme()
  const openSettings = useCallback(() => setSettingsOpen(true), [])
  const closeSettings = useCallback(() => setSettingsOpen(false), [])
  const auth = useAuth()
  // Só a preferência que o App usa: mudar outra (tema, zoom do drawer...) não redesenha aqui.
  const welcomeSeen = usePreference('welcomeSeen')
  // Nenhuma conta logada, depois de conferir todas. Com outra conta logada, a principal sem login
  // aparece só em Configurações. Sem o Claude Code na máquina, também falta configurar.
  const loggedOut = !!auth?.accounts.length && auth.accounts.every((a) => a.status?.loggedIn === false)
  const needsSetup = !!auth && (auth.claude.status !== 'found' || loggedOut)
  // Boas-vindas: na primeira vez, o passo a passo inteiro; depois, só se faltar configurar.
  const welcome = !!auth && (!welcomeSeen || needsSetup)

  // Saiu de todas as contas: as configurações fecham e fica a tela de login.
  const [wasWelcome, setWasWelcome] = useState(welcome)
  if (welcome !== wasWelcome) {
    setWasWelcome(welcome)
    if (welcome) setSettingsOpen(false)
  }

  // ⌘, abre as configurações, como nos apps do Mac (Ctrl+, no Windows, como no VS Code). Com as
  // boas-vindas na tela, não: ao clicar "Começar", as configurações apareceriam sozinhas.
  const onSettingsKey = useEffectEvent((e: KeyboardEvent) => {
    if (!isMod(e) || e.key !== ',') return
    e.preventDefault()
    if (!welcome) setSettingsOpen(true)
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onSettingsKey(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <main className="relative h-full">
      {/* Erro ao desenhar o canvas não deixa a janela em branco: aparece o aviso para recarregar. */}
      <ErrorBoundary>
        <ReactFlowProvider>
          <Canvas colorMode={theme.resolved} onOpenSettings={openSettings} />
        </ReactFlowProvider>
      </ErrorBoundary>
      <Presence kind="modal">
        {welcome && auth && (
          <WelcomeModal auth={auth} startAtSetup={welcomeSeen} onDone={() => setPreferences({ welcomeSeen: true })} />
        )}
      </Presence>
      <Presence kind="modal">
        {settingsOpen && !welcome && (
          <SettingsModal theme={theme.preference} onThemeChange={theme.setPreference} onClose={closeSettings} />
        )}
      </Presence>
    </main>
  )
}
