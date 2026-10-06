import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { CanvasNode } from './types'

const LIMIT = 100

// Desfazer/refazer do layout do canvas: guarda a lista de nós antes de cada ação.
// Conteúdo de conversa não entra aqui, só posição, tamanho, nome, cor e estrutura.
export function useHistory(nodes: CanvasNode[], setNodes: Dispatch<SetStateAction<CanvasNode[]>>) {
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const past = useRef<CanvasNode[][]>([])
  const future = useRef<CanvasNode[][]>([])
  const inGesture = useRef(false)

  const record = useCallback(() => {
    past.current.push(nodesRef.current)
    if (past.current.length > LIMIT) past.current.shift()
    future.current = []
  }, [])

  // Ação discreta (menu, renomear, criar): grava o estado anterior e aplica.
  const change = useCallback(
    (update: SetStateAction<CanvasNode[]>) => {
      record()
      setNodes(update)
    },
    [record, setNodes]
  )

  // Arrastar e redimensionar geram várias mudanças por gesto: grava só no início.
  const trackGesture = useCallback(
    (active: boolean) => {
      if (active && !inGesture.current) {
        inGesture.current = true
        record()
      }
    },
    [record]
  )

  useEffect(() => {
    const end = () => (inGesture.current = false)
    window.addEventListener('pointerup', end, true)
    return () => window.removeEventListener('pointerup', end, true)
  }, [])

  const step = useCallback(
    (from: typeof past, to: typeof past) => {
      const snapshot = from.current.pop()
      if (!snapshot) return
      to.current.push(nodesRef.current)
      setNodes(snapshot.map((n) => ({ ...n, selected: false })))
    },
    [setNodes]
  )

  const undo = useCallback(() => step(past, future), [step])
  const redo = useCallback(() => step(future, past), [step])

  return { nodesRef, change, trackGesture, undo, redo }
}
