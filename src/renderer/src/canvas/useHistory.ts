import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { CanvasNode } from './types'

// Desfazer/refazer do layout do canvas. O histórico fica no processo principal, um só para
// todas as janelas: ⌘Z desfaz a última ação, feita em qualquer uma (ver main/canvasHub.ts).
// Conteúdo de conversa não entra aqui, só posição, tamanho, nome, cor e estrutura.
export function useHistory(nodes: CanvasNode[], setNodes: Dispatch<SetStateAction<CanvasNode[]>>) {
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const inGesture = useRef(false)

  // Ação discreta (menu, renomear, criar): grava o estado anterior e aplica.
  const change = useCallback(
    (update: SetStateAction<CanvasNode[]>) => {
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
