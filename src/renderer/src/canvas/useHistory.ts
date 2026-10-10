import { useCallback, useEffect, useLayoutEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { CanvasNode } from './types'

// Desfazer/refazer do layout do canvas. O histórico fica no processo principal, um só para
// todas as janelas: ⌘Z desfaz a última ação, feita em qualquer uma (ver main/canvasHub.ts).
// Conteúdo de conversa não entra aqui, só posição, tamanho, nome, cor e estrutura.
export function useHistory(nodes: CanvasNode[], setNodes: Dispatch<SetStateAction<CanvasNode[]>>) {
  // Lista atual para quem age fora do render (menus, atalhos, assistente do canvas). Atualizada
  // logo depois do render: escrita durante ele, o React Compiler recusaria otimizar o Canvas.
  const nodesRef = useRef(nodes)
  useLayoutEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  const inGesture = useRef(false)

  // Ação discreta (menu, renomear, criar): grava o estado anterior e aplica. Sem mudança de fato
  // (as operações devolvem a mesma lista: cor igual, grupo já ajustado), não grava passo vazio no
  // ⌘Z. A lista calculada vai logo para o nodesRef: outra ação no mesmo clique (criar e depois
  // revelar) já parte dela. O estado em si continua aplicado pela função, na fila do React.
  const change = useCallback(
    (update: SetStateAction<CanvasNode[]>) => {
      const current = nodesRef.current
      const next = typeof update === 'function' ? update(current) : update
      if (next === current) return
      nodesRef.current = next
      window.api.canvas.record()
      setNodes(update)
    },
    [setNodes]
  )

  // Arrastar e redimensionar geram várias mudanças por gesto: grava só no início.
  const trackGesture = useCallback((active: boolean) => {
    if (active && !inGesture.current) {
      inGesture.current = true
      window.api.canvas.record()
    }
  }, [])

  useEffect(() => {
    const end = () => (inGesture.current = false)
    window.addEventListener('pointerup', end, true)
    return () => window.removeEventListener('pointerup', end, true)
  }, [])

  // O estado desfeito volta pelo processo principal, para esta e para as outras janelas.
  const undo = useCallback(() => window.api.canvas.undo(), [])
  const redo = useCallback(() => window.api.canvas.redo(), [])

  return { nodesRef, change, trackGesture, undo, redo }
}
