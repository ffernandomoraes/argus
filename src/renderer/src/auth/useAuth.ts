import { useEffect, useState } from 'react'
import type { AuthState } from '../../../shared/auth'

// Conta do Claude Code e o login em andamento; nulo até o processo principal responder.
export function useAuth(): AuthState | null {
  const [state, setState] = useState<AuthState | null>(null)
  useEffect(() => {
    window.api.auth.state().then(setState)
    return window.api.auth.onState(setState)
  }, [])
  return state
}
