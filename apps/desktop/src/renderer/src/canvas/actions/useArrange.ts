import { useCallback, useEffect, useRef, useState } from 'react'
import { boundsOf, organizeBoard as boardLayout, organizeGroup as groupLayout } from '../operations'
import type { CanvasNode } from '../types'
import { useFrame } from '../useCanvasShortcuts'
import type { NodesApi } from './types'

// Tempo da classe `arranging` no canvas: os blocos deslizam até o lugar novo em vez de saltar.
const SLIDE_MS = 450

// "Organizar board" e "Organizar grupo". Um ⌘Z desfaz tudo.
export function useArrange({ nodesRef, change }: NodesApi) {
  const [arranging, setArranging] = useState(false)
  const { frame, freeAspect } = useFrame()
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])

  // Sem mudança (já organizado), nada vai para o desfazer nem para a câmera.
  const arrange = useCallback(
    (next: CanvasNode[]) => {
      if (next === nodesRef.current) return false
      setArranging(true)
      change(next)
      clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setArranging(false), SLIDE_MS)
      return true
    },
    [nodesRef, change]
  )

  // Os blocos vão para linhas no formato da área livre entre as barras, e a câmera enquadra o
  // board inteiro nela, como o "Ver tudo", já no lugar final dos blocos.
  const organizeBoard = useCallback(() => {
    const next = boardLayout(nodesRef.current, freeAspect())
    if (arrange(next)) frame(boundsOf(next.filter((n) => !n.parentId && !n.hidden)))
  }, [nodesRef, freeAspect, arrange, frame])

  // O grupo pode crescer para baixo das barras: aí a câmera vai até ele, sem aproximar.
  const organizeGroup = useCallback(
    (id: string) => {
      const next = groupLayout(nodesRef.current, id, freeAspect())
      const group = next.find((n) => n.id === id)
      if (arrange(next) && group) frame(boundsOf([group]), { onlyIfCovered: true })
    },
    [nodesRef, freeAspect, arrange, frame]
  )

  return { arranging, organizeBoard, organizeGroup }
}
