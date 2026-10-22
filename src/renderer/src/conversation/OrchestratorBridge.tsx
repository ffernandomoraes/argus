import { useEffect } from 'react'
import { usePreference } from '../settings/preferences'

// O experimento do orquestrador fica nas preferências desta janela (localStorage); o processo
// principal precisa saber para dar a ferramenta delegate às conversas que abrem (ver
// src/main/orchestration/).
export function OrchestratorBridge() {
  const on = usePreference('orchestratorEnabled')
  useEffect(() => window.api.orchestrator.setEnabled(on), [on])
  return null
}
