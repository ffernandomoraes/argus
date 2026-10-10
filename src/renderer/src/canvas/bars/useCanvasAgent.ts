import { useEffect, useState } from 'react'
import type { CanvasAgentState } from '../../../../shared/canvasAgent'

const IDLE: CanvasAgentState = { status: 'idle', reply: '' }

// Acompanha o assistente do canvas: pede o estado atual e ouve as mudanças. A resposta do pedido
// pode chegar depois de um aviso mais novo; nesse caso ela é velha e fica de fora.
function watchCanvasAgent(onState: (state: CanvasAgentState) => void): () => void {
  let alive = true
  let heard = false
  const off = window.api.canvasAgent.onState((state) => {
    heard = true
    onState(state)
  })
  window.api.canvasAgent.state().then(
    (state) => alive && !heard && onState(state),
    (err: unknown) => console.error('[canvas] estado do assistente:', err)
  )
  return () => {
    alive = false
    off()
  }
}

// Estado do assistente do canvas (o Claude que mexe nos blocos), atualizado pelo processo principal.
export function useCanvasAgent(): CanvasAgentState {
  const [agent, setAgent] = useState<CanvasAgentState>(IDLE)
  useEffect(() => watchCanvasAgent(setAgent), [])
  return agent
}
