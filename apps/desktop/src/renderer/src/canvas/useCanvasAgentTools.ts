import { useEffect, useEffectEvent, type RefObject } from 'react'
import { useReactFlow, type XYPosition } from '@xyflow/react'
import { runTool, type ToolEnv } from './agentTools'
import type { CanvasNode } from './types'

// Executa as ações que o assistente do canvas pede (as ferramentas ficam em ./agentTools).
// Toda mudança passa por `change`, então ⌘Z desfaz o que o Claude fez, uma ação por vez.
export function useCanvasAgentTools(nodesRef: RefObject<CanvasNode[]>, change: (update: CanvasNode[]) => void) {
  const { screenToFlowPosition, fitView } = useReactFlow()

  // Aplica na hora e já atualiza a referência: a próxima ação pode chegar antes de a tela redesenhar.
  const apply = useEffectEvent((next: CanvasNode[]) => {
    change(next)
    nodesRef.current = next
  })
  const toFlow = useEffectEvent((point: XYPosition) => screenToFlowPosition(point))
  const frame = useEffectEvent((ids: string[]) => {
    void fitView({ padding: 0.2, duration: 300, maxZoom: 1, ...(ids.length && { nodes: ids.map((id) => ({ id })) }) })
  })

  useEffect(() => {
    // Ações em andamento e as que o processo principal cancelou (tempo esgotado, "parar"): a
    // cancelada não mexe mais no canvas (a pasta escolhida no seletor depois do cancelamento não
    // entra) e não responde, porque o principal já respondeu por ela.
    const running = new Set<string>()
    const cancelled = new Set<string>()
    const envFor = (id: string): ToolEnv => ({
      nodes: () => nodesRef.current,
      apply: (next) => {
        if (!cancelled.has(id)) apply(next)
      },
      screenCenter: () => toFlow({ x: window.innerWidth / 2, y: window.innerHeight / 2 }),
      visibleArea: () => ({
        topLeft: toFlow({ x: 0, y: 0 }),
        bottomRight: toFlow({ x: window.innerWidth, y: window.innerHeight })
      }),
      // Espera a tela desenhar o que acabou de mudar.
      frame: (ids) => {
        if (!cancelled.has(id)) setTimeout(() => frame(ids), 50)
      },
      pickFolder: () => window.api.pickFolder(),
      killTerminal: (key) => {
        if (!cancelled.has(id)) window.api.terminal.kill(key)
      }
    })
    const offCancel = window.api.canvasAgent.onCancel((id) => {
      if (running.has(id)) cancelled.add(id)
    })
    const offCall = window.api.canvasAgent.onCall((call) => {
      running.add(call.id)
      void runTool(call, envFor(call.id)).then((result) => {
        running.delete(call.id)
        if (!cancelled.delete(call.id)) window.api.canvasAgent.respond(result)
      })
    })
    return () => {
      offCall()
      offCancel()
    }
  }, [nodesRef])
}
