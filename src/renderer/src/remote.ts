import { useEffect, useState } from 'react'
import type { RemoteConnectionState } from '../../shared/remote'

// Janela de acesso remoto: mostra o Argus de outro computador (ver src/main/remote). Nela, os
// caminhos e o sistema são os de lá; o que só faz sentido na máquina de quem usa (abrir no Finder,
// ditado, janela avulsa, mascote, o player) sai da tela.

// `?.`: o window.api falso dos testes não tem o campo.
export const REMOTE_HOST = window.api.remote?.host ?? null
export const IS_REMOTE = REMOTE_HOST !== null

export function useRemoteState(): RemoteConnectionState {
  const [state, setState] = useState<RemoteConnectionState>('connected')
  useEffect(() => (IS_REMOTE ? window.api.remote.onState(setState) : undefined), [])
  return state
}
