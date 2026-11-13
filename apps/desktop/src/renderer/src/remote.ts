import { useEffect, useState } from 'react'
import type { RemoteAccessState, RemoteConnectionState } from '@argus/shared/remote'

// Janela de acesso remoto: mostra o Argus de outro computador (ver src/main/remote). Nela, os
// caminhos e o sistema são os de lá; o que só faz sentido na máquina de quem usa (abrir no Finder,
// janela avulsa, mascote, o player) sai da tela.

// `?.`: o window.api falso dos testes não tem o campo.
export const REMOTE_HOST = window.api.remote?.host ?? null
export const IS_REMOTE = REMOTE_HOST !== null

export function useRemoteState(): RemoteConnectionState {
  const [state, setState] = useState<RemoteConnectionState>('connected')
  useEffect(() => (IS_REMOTE ? window.api.remote.onState(setState) : undefined), [])
  return state
}

// O acesso remoto deste computador (aparelhos pareados e conectados, código de pareamento). Só nas
// janelas daqui: na janela remota, nulo (é do outro computador e ela não pergunta).
export function useRemoteAccess(): RemoteAccessState | null {
  const [state, setState] = useState<RemoteAccessState | null>(null)
  useEffect(() => {
    if (IS_REMOTE) return
    let alive = true
    void window.api.remoteAccess.state().then((s) => alive && setState(s))
    const off = window.api.remoteAccess.onState(setState)
    return () => {
      alive = false
      off()
    }
  }, [])
  return state
}
